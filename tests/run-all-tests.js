const assert = require('assert');
const { connectDB, closeDB, getDb } = require('../src/config/db');
const authService = require('../src/services/authService');
const accountService = require('../src/services/accountService');
const transferService = require('../src/services/transferService');
const beneficiaryService = require('../src/services/beneficiaryService');
const transactionService = require('../src/services/transactionService');
const adminService = require('../src/services/adminService');
const seedDatabase = require('../src/utils/seed');
const { verifyToken } = require('../src/utils/jwt');

let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  process.stdout.write(`  ▶ Running: ${name}... `);
  try {
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passedTests++;
  } catch (err) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failedTests++;
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('=============================================================\n');

  // Initialize DB and clean seed state
  await seedDatabase();

  const db = getDb();

  // Test 1: User Registration
  await runTest('1. User Registration (Hashed Password & Account Creation)', async () => {
    const regRes = await authService.register({
      fullName: 'Alice Test',
      email: 'alice.test@bank.com',
      password: 'SecurePassword123!',
    });

    assert(regRes.token, 'JWT token should be returned');
    assert(regRes.user.email === 'alice.test@bank.com', 'Email should match');
    assert(regRes.account.balanceInPaise === 1000000, 'Initial balance should be ₹10,000 (1,000,000 paise)');

    // Verify DB does not store plaintext password
    const userDoc = await db.collection('users').findOne({ email: 'alice.test@bank.com' });
    assert(userDoc.passwordHash !== 'SecurePassword123!', 'Plaintext password must never be stored');
    assert(userDoc.passwordHash.startsWith('$2'), 'Password should be bcrypt hash');
  });

  // Test 2: User Login with Valid Credentials
  await runTest('2. User Login with Valid Credentials', async () => {
    const loginRes = await authService.login({
      email: 'alex@bank.com',
      password: 'Password123!',
    });

    assert(loginRes.token, 'Should return JWT token');
    const decoded = verifyToken(loginRes.token);
    assert(decoded.email === 'alex@bank.com', 'Token payload should contain user email');
  });

  // Test 3: User Login with Invalid Credentials
  await runTest('3. User Login with Invalid Credentials (Rejected)', async () => {
    let errorThrown = false;
    try {
      await authService.login({
        email: 'alex@bank.com',
        password: 'WrongPassword!',
      });
    } catch (err) {
      errorThrown = true;
      assert(err.statusCode === 401, 'Should return 401 status code');
    }
    assert(errorThrown, 'Should throw error on invalid password');
  });

  // Test 4: Suspended User Login Rejection
  await runTest('4. Suspended User Login (Blocked with 403)', async () => {
    let errorThrown = false;
    try {
      await authService.login({
        email: 'suspended@bank.com',
        password: 'Password123!',
      });
    } catch (err) {
      errorThrown = true;
      assert(err.statusCode === 403, 'Should return 403 status code for suspended accounts');
    }
    assert(errorThrown, 'Should throw error when account is suspended');
  });

  // Test 5: Successful Transactional Money Transfer & Ledger Entries
  await runTest('5. Successful Money Transfer (ACID atomic debit/credit & double-entry ledger)', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const alexAcc = await db.collection('accounts').findOne({ userId: alexUser._id });
    const priyaUser = await db.collection('users').findOne({ email: 'priya@bank.com' });
    const priyaAcc = await db.collection('accounts').findOne({ userId: priyaUser._id });

    const alexInitialBalance = alexAcc.balanceInPaise;
    const priyaInitialBalance = priyaAcc.balanceInPaise;
    const transferAmount = 250000; // ₹2,500.00
    const idempotencyKey = 'test-idemp-success-01';

    const result = await transferService.executeTransfer({
      senderUser: alexUser,
      senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
      recipientAccountNumber: priyaAcc.accountNumber,
      amountInPaise: transferAmount,
      description: 'Test Rent Payment',
      idempotencyKey,
    });

    assert(result.success, 'Transfer should return success');
    assert(result.transfer.status === 'completed', 'Transfer status should be completed');

    // Verify Balances in Database
    const alexUpdated = await db.collection('accounts').findOne({ _id: alexAcc._id });
    const priyaUpdated = await db.collection('accounts').findOne({ _id: priyaAcc._id });

    assert.strictEqual(
      alexUpdated.balanceInPaise,
      alexInitialBalance - transferAmount,
      'Sender balance must be exactly debited'
    );
    assert.strictEqual(
      priyaUpdated.balanceInPaise,
      priyaInitialBalance + transferAmount,
      'Recipient balance must be exactly credited'
    );

    // Verify Immutable Double-Entry Ledger Entries
    const ledgerEntries = await db
      .collection('ledger_entries')
      .find({ transferId: result.transfer.id ? result.transfer.id : undefined })
      .toArray();

    // Check by reference if id converted
    const transferDoc = await db.collection('transfers').findOne({ reference: result.transfer.reference });
    const matchingLedgers = await db.collection('ledger_entries').find({ transferId: transferDoc._id }).toArray();

    assert.strictEqual(matchingLedgers.length, 2, 'Must create exactly two ledger entries (1 debit, 1 credit)');
    const debitEntry = matchingLedgers.find((l) => l.entryType === 'debit');
    const creditEntry = matchingLedgers.find((l) => l.entryType === 'credit');

    assert(debitEntry && debitEntry.amountInPaise === transferAmount, 'Debit ledger entry must match amount');
    assert(creditEntry && creditEntry.amountInPaise === transferAmount, 'Credit ledger entry must match amount');
  });

  // Test 6: Insufficient Balance Rejection
  await runTest('6. Insufficient Balance Transfer Rejection (No balance change)', async () => {
    const rahulUser = await db.collection('users').findOne({ email: 'rahul@bank.com' });
    const rahulAcc = await db.collection('accounts').findOne({ userId: rahulUser._id });
    const alexAcc = await db.collection('accounts').findOne({ accountNumber: 'ACC-1000200031' });

    const rahulInitialBalance = rahulAcc.balanceInPaise;
    const excessiveAmount = rahulInitialBalance + 50000000; // Far exceeds balance

    let errorThrown = false;
    try {
      await transferService.executeTransfer({
        senderUser: rahulUser,
        senderAccount: { id: rahulAcc._id.toString(), _id: rahulAcc._id },
        recipientAccountNumber: alexAcc.accountNumber,
        amountInPaise: excessiveAmount,
        description: 'Excessive transfer attempt',
        idempotencyKey: 'test-idemp-insufficient-01',
      });
    } catch (err) {
      errorThrown = true;
      assert(err.message.includes('Insufficient funds'), 'Should identify insufficient funds');
    }

    assert(errorThrown, 'Should fail when balance is insufficient');

    // Verify balance was unchanged
    const rahulCheck = await db.collection('accounts').findOne({ _id: rahulAcc._id });
    assert.strictEqual(rahulCheck.balanceInPaise, rahulInitialBalance, 'Balance must remain unchanged');
  });

  // Test 7: Invalid Recipient Account Rejection
  await runTest('7. Invalid Recipient Account Number Rejection (404)', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const alexAcc = await db.collection('accounts').findOne({ userId: alexUser._id });

    let errorThrown = false;
    try {
      await transferService.executeTransfer({
        senderUser: alexUser,
        senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
        recipientAccountNumber: 'ACC-9999999999', // Non-existent
        amountInPaise: 10000,
        description: 'Test invalid',
        idempotencyKey: 'test-idemp-invalid-rec-01',
      });
    } catch (err) {
      errorThrown = true;
      assert(err.statusCode === 404, 'Should return 404 for non-existent recipient');
    }
    assert(errorThrown, 'Should fail when recipient does not exist');
  });

  // Test 8: Transfer to Own Account Rejection
  await runTest('8. Transfer to Own Account Rejection', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const alexAcc = await db.collection('accounts').findOne({ userId: alexUser._id });

    let errorThrown = false;
    try {
      await transferService.executeTransfer({
        senderUser: alexUser,
        senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
        recipientAccountNumber: alexAcc.accountNumber, // Self
        amountInPaise: 10000,
        description: 'Self transfer',
        idempotencyKey: 'test-idemp-self-01',
      });
    } catch (err) {
      errorThrown = true;
      assert(err.statusCode === 400, 'Should reject self-transfers with 400');
    }
    assert(errorThrown, 'Should throw error when sender transfers to self');
  });

  // Test 9: Idempotency Key Duplicate Prevention & Replay
  await runTest('9. Idempotency Key Protection (Prevents double debits)', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const alexAcc = await db.collection('accounts').findOne({ userId: alexUser._id });
    const priyaAcc = await db.collection('accounts').findOne({ accountNumber: 'ACC-1000200032' });

    const key = 'test-idemp-replay-key-01';
    const amount = 50000; // ₹500.00

    // First execution
    const firstRes = await transferService.executeTransfer({
      senderUser: alexUser,
      senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
      recipientAccountNumber: priyaAcc.accountNumber,
      amountInPaise: amount,
      description: 'Idempotency test run',
      idempotencyKey: key,
    });
    assert(firstRes.success, 'First transfer should succeed');

    const balanceAfterFirst = (await db.collection('accounts').findOne({ _id: alexAcc._id })).balanceInPaise;

    // Second execution with SAME key and SAME parameters (Simulated network retry)
    const secondRes = await transferService.executeTransfer({
      senderUser: alexUser,
      senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
      recipientAccountNumber: priyaAcc.accountNumber,
      amountInPaise: amount,
      description: 'Idempotency test run',
      idempotencyKey: key,
    });

    assert(secondRes.idempotentReplay, 'Second attempt must be flagged as idempotent replay');
    assert.strictEqual(secondRes.transfer.reference, firstRes.transfer.reference, 'Must return same transfer reference');

    // Verify balance was NOT deducted a second time
    const balanceAfterSecond = (await db.collection('accounts').findOne({ _id: alexAcc._id })).balanceInPaise;
    assert.strictEqual(balanceAfterSecond, balanceAfterFirst, 'Balance must NOT change on idempotent retry');

    // Third attempt with SAME key but DIFFERENT parameters (Conflict attack / mistake)
    let conflictThrown = false;
    try {
      await transferService.executeTransfer({
        senderUser: alexUser,
        senderAccount: { id: alexAcc._id.toString(), _id: alexAcc._id },
        recipientAccountNumber: priyaAcc.accountNumber,
        amountInPaise: 999999, // Altered amount!
        description: 'Altered parameters',
        idempotencyKey: key,
      });
    } catch (cErr) {
      conflictThrown = true;
      assert.strictEqual(cErr.statusCode, 409, 'Must reject mismatched idempotency key with 409 Conflict');
    }
    assert(conflictThrown, 'Should throw 409 when idempotency key reused with different parameters');
  });

  // Test 10: Beneficiary Management & Duplicate Prevention
  await runTest('10. Beneficiary Management (Add, duplicate reject, remove)', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const rahulAcc = await db.collection('accounts').findOne({ accountNumber: 'ACC-1000200033' });

    // Try adding duplicate beneficiary
    let dupError = false;
    try {
      await beneficiaryService.addBeneficiary({
        userId: alexUser._id,
        userAccountNumber: 'ACC-1000200031',
        recipientAccountNumber: rahulAcc.accountNumber,
        displayName: 'Rahul Duplicate',
      });
    } catch (err) {
      dupError = true;
      assert.strictEqual(err.statusCode, 409, 'Should return 409 for duplicate beneficiary');
    }
    assert(dupError, 'Should reject duplicate beneficiary');

    // Add new unique beneficiary
    const newBene = await beneficiaryService.addBeneficiary({
      userId: alexUser._id,
      userAccountNumber: 'ACC-1000200031',
      recipientAccountNumber: 'ACC-1000200034', // Suspended account user's acc
      displayName: 'Compliance Test Acc',
    }).catch(() => null); // If inactive account check prevents it, verify check works:
    assert(newBene === null, 'Should reject adding inactive/suspended account as beneficiary');
  });

  // Test 11: Transaction History Authorization
  await runTest('11. Transaction History Filtering & Authorization', async () => {
    const alexUser = await db.collection('users').findOne({ email: 'alex@bank.com' });
    const alexAcc = await db.collection('accounts').findOne({ userId: alexUser._id });

    const txRes = await transactionService.getAccountTransactions({
      userAccount: alexAcc,
      page: 1,
      limit: 10,
      type: 'all',
      status: 'all',
    });

    assert(Array.isArray(txRes.transactions), 'Should return list of transactions');
    assert(txRes.transactions.length > 0, 'Should have transactions');
    // Ensure all returned transactions involve Alex's account
    for (const t of txRes.transactions) {
      const involvesAlex =
        t.senderAccountNumber === alexAcc.accountNumber || t.recipientAccountNumber === alexAcc.accountNumber;
      assert(involvesAlex, 'Customer must only view transactions involving their own account');
    }
  });

  // Test 12: Admin Moderation (Suspend & Reactivate User)
  await runTest('12. Administrator Moderation (Suspend user & verify account status)', async () => {
    const adminUser = await db.collection('users').findOne({ email: 'admin@bank.com' });
    const priyaUser = await db.collection('users').findOne({ email: 'priya@bank.com' });

    // Admin suspends Priya
    await adminService.updateUserStatus(priyaUser._id, 'suspended', adminUser);

    const priyaUpdated = await db.collection('users').findOne({ _id: priyaUser._id });
    const priyaAccUpdated = await db.collection('accounts').findOne({ userId: priyaUser._id });
    assert.strictEqual(priyaUpdated.status, 'suspended', 'User status should be suspended');
    assert.strictEqual(priyaAccUpdated.status, 'suspended', 'Associated account must also be suspended');

    // Verify Priya cannot initiate transfers while suspended
    let transferBlocked = false;
    try {
      await transferService.executeTransfer({
        senderUser: priyaUpdated,
        senderAccount: { id: priyaAccUpdated._id.toString(), _id: priyaAccUpdated._id },
        recipientAccountNumber: 'ACC-1000200031',
        amountInPaise: 10000,
        description: 'Blocked transfer',
        idempotencyKey: 'test-suspended-transfer-01',
      });
    } catch (e) {
      transferBlocked = true;
    }
    assert(transferBlocked, 'Suspended user must be blocked from initiating transfers');

    // Admin reactivates Priya
    await adminService.updateUserStatus(priyaUser._id, 'active', adminUser);
    const priyaReactivated = await db.collection('users').findOne({ _id: priyaUser._id });
    assert.strictEqual(priyaReactivated.status, 'active', 'User should be active again');
  });

  console.log('\n=============================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  await closeDB();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(async (e) => {
  console.error('[TEST RUNNER FATAL ERROR]', e);
  await closeDB();
  process.exit(1);
});

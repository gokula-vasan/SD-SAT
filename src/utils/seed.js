const bcrypt = require('bcryptjs');
const { connectDB, closeDB, getDb } = require('../config/db');

async function seedDatabase() {
  console.log('[SEED] Connecting to database...');
  await connectDB();
  const db = getDb();

  console.log('[SEED] Cleaning existing collections...');
  await db.collection('users').deleteMany({});
  await db.collection('accounts').deleteMany({});
  await db.collection('beneficiaries').deleteMany({});
  await db.collection('transfers').deleteMany({});
  await db.collection('ledger_entries').deleteMany({});
  await db.collection('notifications').deleteMany({});
  await db.collection('audit_logs').deleteMany({});

  console.log('[SEED] Hashing passwords...');
  const salt = await bcrypt.genSalt(10);
  const userPasswordHash = await bcrypt.hash('Password123!', salt);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', salt);

  const now = new Date();

  // 1. Insert Users
  console.log('[SEED] Inserting fictional users...');
  const usersToInsert = [
    {
      fullName: 'System Administrator',
      email: 'admin@bank.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      createdAt: new Date(now.getTime() - 30 * 86400000),
      updatedAt: now,
    },
    {
      fullName: 'Alex Johnson',
      email: 'alex@bank.com',
      passwordHash: userPasswordHash,
      role: 'customer',
      status: 'active',
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: now,
    },
    {
      fullName: 'Priya Sharma',
      email: 'priya@bank.com',
      passwordHash: userPasswordHash,
      role: 'customer',
      status: 'active',
      createdAt: new Date(now.getTime() - 15 * 86400000),
      updatedAt: now,
    },
    {
      fullName: 'Rahul Verma',
      email: 'rahul@bank.com',
      passwordHash: userPasswordHash,
      role: 'customer',
      status: 'active',
      createdAt: new Date(now.getTime() - 10 * 86400000),
      updatedAt: now,
    },
    {
      fullName: 'Suspended Account User',
      email: 'suspended@bank.com',
      passwordHash: userPasswordHash,
      role: 'customer',
      status: 'suspended',
      createdAt: new Date(now.getTime() - 5 * 86400000),
      updatedAt: now,
    },
  ];

  const userInsertResult = await db.collection('users').insertMany(usersToInsert);
  const adminUser = { ...usersToInsert[0], _id: userInsertResult.insertedIds[0] };
  const alexUser = { ...usersToInsert[1], _id: userInsertResult.insertedIds[1] };
  const priyaUser = { ...usersToInsert[2], _id: userInsertResult.insertedIds[2] };
  const rahulUser = { ...usersToInsert[3], _id: userInsertResult.insertedIds[3] };
  const suspendedUser = { ...usersToInsert[4], _id: userInsertResult.insertedIds[4] };

  // 2. Insert Accounts
  console.log('[SEED] Creating simulated bank accounts...');
  const accountsToInsert = [
    {
      userId: alexUser._id,
      accountNumber: 'ACC-1000200031',
      balanceInPaise: 4850000, // ₹48,500.00 (initial ₹50,000 minus ₹1,500 transferred to Priya)
      currency: 'INR',
      status: 'active',
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: now,
    },
    {
      userId: priyaUser._id,
      accountNumber: 'ACC-1000200032',
      balanceInPaise: 3650000, // ₹36,500.00 (initial ₹35,000 plus ₹1,500 transferred from Alex)
      currency: 'INR',
      status: 'active',
      createdAt: new Date(now.getTime() - 15 * 86400000),
      updatedAt: now,
    },
    {
      userId: rahulUser._id,
      accountNumber: 'ACC-1000200033',
      balanceInPaise: 2000000, // ₹20,000.00
      currency: 'INR',
      status: 'active',
      createdAt: new Date(now.getTime() - 10 * 86400000),
      updatedAt: now,
    },
    {
      userId: suspendedUser._id,
      accountNumber: 'ACC-1000200034',
      balanceInPaise: 500000, // ₹5,000.00
      currency: 'INR',
      status: 'suspended',
      createdAt: new Date(now.getTime() - 5 * 86400000),
      updatedAt: now,
    },
  ];

  const accountInsertResult = await db.collection('accounts').insertMany(accountsToInsert);
  const alexAccount = { ...accountsToInsert[0], _id: accountInsertResult.insertedIds[0] };
  const priyaAccount = { ...accountsToInsert[1], _id: accountInsertResult.insertedIds[1] };
  const rahulAccount = { ...accountsToInsert[2], _id: accountInsertResult.insertedIds[2] };

  // 3. Beneficiaries
  console.log('[SEED] Setting up beneficiaries...');
  await db.collection('beneficiaries').insertMany([
    {
      userId: alexUser._id,
      beneficiaryAccountId: priyaAccount._id,
      displayName: 'Priya Sharma (Personal)',
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      userId: alexUser._id,
      beneficiaryAccountId: rahulAccount._id,
      displayName: 'Rahul Verma (Project)',
      createdAt: new Date(now.getTime() - 4 * 86400000),
    },
    {
      userId: priyaUser._id,
      beneficiaryAccountId: alexAccount._id,
      displayName: 'Alex Johnson',
      createdAt: new Date(now.getTime() - 3 * 86400000),
    },
  ]);

  // 4. Sample Completed Transfer & Ledger Entries
  console.log('[SEED] Recording sample transfer and ledger entries...');
  const sampleTransfer = {
    reference: 'TXN-20261010-SEED01',
    senderAccountId: alexAccount._id,
    recipientAccountId: priyaAccount._id,
    amountInPaise: 150000, // ₹1,500.00
    description: 'Project consultation fee',
    status: 'completed',
    idempotencyKey: 'seed-idempotency-key-001',
    initiatedAt: new Date(now.getTime() - 2 * 86400000),
    completedAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    failureReason: null,
  };
  const transferRes = await db.collection('transfers').insertOne(sampleTransfer);
  const transferId = transferRes.insertedId;

  // Ledger: One debit, one credit
  await db.collection('ledger_entries').insertMany([
    {
      transferId,
      accountId: alexAccount._id,
      entryType: 'debit',
      amountInPaise: 150000,
      createdAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    },
    {
      transferId,
      accountId: priyaAccount._id,
      entryType: 'credit',
      amountInPaise: 150000,
      createdAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    },
  ]);

  // Notifications
  await db.collection('notifications').insertMany([
    {
      userId: alexUser._id,
      type: 'TRANSFER_SENT',
      message: `Successfully transferred ₹1,500.00 to account ${priyaAccount.accountNumber}. Ref: TXN-20261010-SEED01`,
      relatedTransferId: transferId,
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    },
    {
      userId: priyaUser._id,
      type: 'TRANSFER_RECEIVED',
      message: `Received ₹1,500.00 from account ${alexAccount.accountNumber}. Ref: TXN-20261010-SEED01`,
      relatedTransferId: transferId,
      isRead: false,
      createdAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    },
  ]);

  // Audit Logs
  await db.collection('audit_logs').insertMany([
    {
      actorUserId: alexUser._id,
      action: 'TRANSFER_COMPLETED',
      entityType: 'transfer',
      entityId: transferId,
      metadata: {
        reference: 'TXN-20261010-SEED01',
        amountInPaise: 150000,
        sender: alexAccount.accountNumber,
        recipient: priyaAccount.accountNumber,
      },
      createdAt: new Date(now.getTime() - 2 * 86400000 + 1000),
    },
    {
      actorUserId: adminUser._id,
      action: 'USER_STATUS_UPDATED',
      entityType: 'user',
      entityId: suspendedUser._id,
      metadata: {
        targetEmail: suspendedUser.email,
        newStatus: 'suspended',
        reason: 'Compliance audit pending',
      },
      createdAt: new Date(now.getTime() - 1 * 86400000),
    },
  ]);

  console.log('---------------------------------------------------------');
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('---------------------------------------------------------');
  console.log('🔑 DEMO CREDENTIALS:');
  console.log('  Customer 1: alex@bank.com / Password123! (Balance: ₹48,500.00, Acc: ACC-1000200031)');
  console.log('  Customer 2: priya@bank.com / Password123! (Balance: ₹36,500.00, Acc: ACC-1000200032)');
  console.log('  Customer 3: rahul@bank.com / Password123! (Balance: ₹20,000.00, Acc: ACC-1000200033)');
  console.log('  Suspended:  suspended@bank.com / Password123! (Status: Suspended)');
  console.log('  Admin:      admin@bank.com / AdminPassword123! (Role: admin)');
  console.log('---------------------------------------------------------');
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SEED ERROR]', err);
      await closeDB();
      process.exit(1);
    });
}

module.exports = seedDatabase;

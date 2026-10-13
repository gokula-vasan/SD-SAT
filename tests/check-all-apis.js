/**
 * API Verification Script with Permanent JWT
 * Verifies that the JWT has NO expiration ('exp' claim omitted) and tests all system REST APIs
 */

const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_digital_banking_system_2026_secure';

function makeRequest(method, path, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let payloadData = null;
    if (body) {
      payloadData = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payloadData);
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (payloadData) {
      req.write(payloadData);
    }
    req.end();
  });
}

async function verifyAllApis() {
  console.log('===============================================================');
  console.log('🔍 VERIFYING PERMANENT JWT & TESTING ALL SYSTEM REST APIS');
  console.log('===============================================================\n');

  let results = [];

  function record(apiName, passed, details) {
    results.push({ apiName, passed, details });
    const mark = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${mark} ${apiName}: ${details}`);
  }

  try {
    // 1. Health Check
    const health = await makeRequest('GET', '/api/health');
    record('GET /api/health', health.statusCode === 200, `Status: ${health.statusCode}, DB: ${health.data.database}`);

    // 2. Customer Login & Permanent JWT Check
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'alex@bank.com',
      password: 'Password123!',
    });

    const customerToken = loginRes.data.data ? loginRes.data.data.token : null;
    const isLoginOk = loginRes.statusCode === 200 && Boolean(customerToken);
    record('POST /api/auth/login (Customer)', isLoginOk, `Received token for ${loginRes.data?.data?.user?.email || 'N/A'}`);

    // Decode JWT to verify it is PERMANENT (NO 'exp' claim)
    const decodedCustomer = jwt.decode(customerToken);
    const isPermanent = decodedCustomer && decodedCustomer.exp === undefined;
    record(
      'Permanent JWT Verification',
      isPermanent,
      isPermanent
        ? `Confirmed! Token has NO 'exp' claim (Never expires). Payload: ${JSON.stringify(decodedCustomer)}`
        : `Token expires at ${new Date(decodedCustomer.exp * 1000).toISOString()}`
    );

    // 3. GET /api/auth/me
    const meRes = await makeRequest('GET', '/api/auth/me', null, customerToken);
    record('GET /api/auth/me', meRes.statusCode === 200, `Account: ${meRes.data?.data?.account?.accountNumber || 'N/A'}`);

    // 4. GET /api/accounts/me
    const accMeRes = await makeRequest('GET', '/api/accounts/me', null, customerToken);
    record('GET /api/accounts/me', accMeRes.statusCode === 200, `Account Number: ${accMeRes.data?.data?.accountNumber || 'N/A'}`);

    // 5. GET /api/accounts/me/balance
    const balanceRes = await makeRequest('GET', '/api/accounts/me/balance', null, customerToken);
    record('GET /api/accounts/me/balance', balanceRes.statusCode === 200, `Balance: ${balanceRes.data?.data?.balanceFormatted || 'N/A'}`);

    // 6. GET /api/accounts/me/dashboard
    const dashRes = await makeRequest('GET', '/api/accounts/me/dashboard', null, customerToken);
    record('GET /api/accounts/me/dashboard', dashRes.statusCode === 200, `Total Credits: ${dashRes.data?.data?.stats?.totalCreditsFormatted}`);

    // 7. GET /api/beneficiaries
    const beneListRes = await makeRequest('GET', '/api/beneficiaries', null, customerToken);
    record('GET /api/beneficiaries', beneListRes.statusCode === 200, `Found ${beneListRes.data?.data?.length || 0} saved beneficiaries`);

    // 8. POST /api/transfers (ACID Money Transfer with Idempotency Key)
    const idempKey = 'perm_test_' + Date.now();
    const transferRes = await makeRequest(
      'POST',
      '/api/transfers',
      {
        recipientAccountNumber: 'ACC-1000200032', // Priya's account
        amount: '100.00',
        description: 'Verified with Permanent JWT',
        idempotencyKey: idempKey,
      },
      customerToken,
      { 'Idempotency-Key': idempKey }
    );
    const transferRef = transferRes.data?.data?.transfer?.reference || 'N/A';
    record('POST /api/transfers', transferRes.statusCode === 201 || transferRes.statusCode === 200, `Ref: ${transferRef}, Status: ${transferRes.data?.data?.transfer?.status}`);

    // 9. GET /api/transfers (Account Transfer List)
    const transferListRes = await makeRequest('GET', '/api/transfers', null, customerToken);
    record('GET /api/transfers', transferListRes.statusCode === 200, `Retrieved ${transferListRes.data?.data?.length || 0} transfers`);

    // 10. GET /api/transactions (Paginated Statement of Account)
    const txRes = await makeRequest('GET', '/api/transactions?page=1&limit=5&type=all&status=all', null, customerToken);
    record('GET /api/transactions', txRes.statusCode === 200, `Total records: ${txRes.data?.pagination?.total}`);

    // 11. GET /api/notifications
    const notifRes = await makeRequest('GET', '/api/notifications', null, customerToken);
    record('GET /api/notifications', notifRes.statusCode === 200, `Unread alerts: ${notifRes.data?.unreadCount}`);

    // 12. PATCH /api/notifications/read-all
    const readAllRes = await makeRequest('PATCH', '/api/notifications/read-all', null, customerToken);
    record('PATCH /api/notifications/read-all', readAllRes.statusCode === 200, `Message: ${readAllRes.data?.message}`);

    // 13. Admin Login & Permanent Admin JWT
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@bank.com',
      password: 'AdminPassword123!',
    });
    const adminToken = adminLoginRes.data?.data?.token;
    const decodedAdmin = jwt.decode(adminToken);
    const isAdminPermanent = decodedAdmin && decodedAdmin.exp === undefined;
    record('POST /api/auth/login (Admin)', adminLoginRes.statusCode === 200, `Role: ${adminLoginRes.data?.data?.user?.role}`);
    record('Permanent Admin JWT Check', isAdminPermanent, `Admin token has NO 'exp' claim (Permanent)`);

    // 14. GET /api/admin/users
    const adminUsersRes = await makeRequest('GET', '/api/admin/users', null, adminToken);
    record('GET /api/admin/users', adminUsersRes.statusCode === 200, `Total users in system: ${adminUsersRes.data?.data?.length}`);

    // 15. GET /api/admin/transfers
    const adminTransfersRes = await makeRequest('GET', '/api/admin/transfers?page=1&limit=10', null, adminToken);
    record('GET /api/admin/transfers', adminTransfersRes.statusCode === 200, `Global transfers monitored: ${adminTransfersRes.data?.pagination?.total}`);

    // 16. GET /api/admin/audit-logs
    const auditRes = await makeRequest('GET', '/api/admin/audit-logs?page=1&limit=10', null, adminToken);
    record('GET /api/admin/audit-logs', auditRes.statusCode === 200, `Audit log entries: ${auditRes.data?.pagination?.total}`);

    // 17. POST /api/auth/logout
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, customerToken);
    record('POST /api/auth/logout', logoutRes.statusCode === 200, `Message: ${logoutRes.data?.message}`);

    console.log('\n===============================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`📊 FINAL RESULT: ${passedCount} / ${results.length} APIS VERIFIED AND WORKING PERFECTLY!`);
    console.log('===============================================================\n');

    console.log('🔑 PERMANENT CUSTOMER JWT (Never expires):');
    console.log(customerToken);
    console.log('\n🔑 PERMANENT ADMIN JWT (Never expires):');
    console.log(adminToken);
    console.log('===============================================================\n');
  } catch (err) {
    console.error('API Verification error:', err);
  }
}

verifyAllApis();

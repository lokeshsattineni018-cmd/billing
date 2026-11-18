const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
process.env.JWT_SECRET = 'test_jwt_secret_key_production_readiness_32b';

const app = require('../../src/app');
const User = require('../../src/models/User');
const Bill = require('../../src/models/Bill');

describe('Export Endpoints Security (?token= vs Bearer) & Partial Filter Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Export Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /export-auth-admin/ });

    adminUser = await User.create({
      name: 'Export Auth Admin',
      username: 'exp_admin',
      email: 'export-auth-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Seed test bills with Pending, Paid, and Partial statuses
    await Bill.create([
      {
        billNo: 7001,
        companyName: 'Export Test Customer A',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 10,
        rate: 500,
        total: 5000,
        grandTotal: 5000,
        paidAmount: 2000,
        balanceAmount: 3000,
        paymentStatus: 'Partial',
        isDeleted: false,
        isVoided: false,
        createdBy: adminUser._id,
      },
      {
        billNo: 7002,
        companyName: 'Export Test Customer B',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 10,
        rate: 500,
        total: 5000,
        grandTotal: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        paymentStatus: 'Paid',
        isDeleted: false,
        isVoided: false,
        createdBy: adminUser._id,
      },
      {
        billNo: 7003,
        companyName: 'Export Test Customer C',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 10,
        rate: 500,
        total: 5000,
        grandTotal: 5000,
        paidAmount: 0,
        balanceAmount: 5000,
        paymentStatus: 'Pending',
        isDeleted: false,
        isVoided: false,
        createdBy: adminUser._id,
      },
    ]);
  });

  after(async () => {
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Export Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /export-auth-admin/ });
    await mongoose.disconnect();
  });

  it('filters CSV export specifically by paymentStatus=Partial', async () => {
    const res = await request(app)
      .get('/api/bills/export/csv?paymentStatus=Partial')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');

    const csvText = res.text;
    assert.ok(csvText.includes('Export Test Customer A'), 'Must include Partial bill');
    assert.ok(!csvText.includes('Export Test Customer B'), 'Must NOT include Paid bill');
    assert.ok(!csvText.includes('Export Test Customer C'), 'Must NOT include Pending bill');
    assert.ok(csvText.includes('"Partial"'), 'Must contain Partial payment status string');
  });

  const exportEndpoints = [
    '/api/bills/export/csv',
    '/api/bills/export/tally',
    '/api/reports/pdf',
    '/api/reports/gst-pdf',
    '/api/reports/gst-export',
    '/api/customers/export/csv',
    '/api/backup/full-export',
    '/api/staff/export',
    '/api/staff/ice/export',
    '/api/staff/wastage/export',
  ];

  for (const endpoint of exportEndpoints) {
    it(`rejects ${endpoint} with ?token= (401) and succeeds with Bearer header (200)`, async () => {
      // 1. Calling with ?token= must return 401 Unauthorized
      const tokenQueryRes = await request(app)
        .get(`${endpoint}?token=${adminToken}`);
      assert.strictEqual(
        tokenQueryRes.status,
        401,
        `Expected ${endpoint}?token= to be rejected with 401 Unauthorized`
      );

      // 2. Calling with Authorization: Bearer <token> must return 200 OK
      const bearerRes = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(
        bearerRes.status,
        200,
        `Expected ${endpoint} with Bearer header to return 200 OK`
      );
    });
  }
});

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
const Settings = require('../../src/models/Settings');

describe('Soft-Deleted Bill Exclusion Integration Tests (Backup & GSTR-1)', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /SoftDelete Exclusion/ });
    await mongoose.connection.collection('users').deleteMany({ email: /softdelete-admin/ });

    adminUser = await User.create({
      name: 'SoftDelete Admin',
      username: 'sd_admin',
      email: 'softdelete-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await Settings.findOneAndUpdate(
      {},
      { backupEmail: 'test-backup@srsf.local', businessName: 'VIJAYA DURGA SEA FOODS' },
      { upsert: true }
    );
  });

  after(async () => {
    await mongoose.connection.collection('bills').deleteMany({ companyName: /SoftDelete Exclusion/ });
    await mongoose.connection.collection('users').deleteMany({ email: /softdelete-admin/ });
    await mongoose.disconnect();
  });

  it('excludes soft-deleted bills from daily email backup summary calculation', async () => {
    const today = new Date();

    // 1. Create an active bill
    const activeBill = await Bill.create({
      billNo: 9001,
      companyName: 'SoftDelete Exclusion Active',
      companyGstin: '37ABCDE1234F1Z5',
      date: today,
      createdAt: today,
      quantity: 10,
      rate: 500,
      total: 5000,
      grandTotal: 5000,
      paymentStatus: 'Pending',
      isDeleted: false,
      isVoided: false,
      createdBy: adminUser._id,
    });

    // 2. Create a soft-deleted bill for the same day
    const deletedBill = await Bill.create({
      billNo: -9002,
      originalBillNo: 9002,
      companyName: 'SoftDelete Exclusion Deleted',
      companyGstin: '37ABCDE1234F1Z5',
      date: today,
      createdAt: today,
      quantity: 10,
      rate: 1000,
      total: 10000,
      grandTotal: 10000,
      paymentStatus: 'Pending',
      isDeleted: true,
      deletedAt: today,
      deletedReason: 'Test soft delete exclusion',
      isVoided: false,
      createdBy: adminUser._id,
    });

    // 3. Trigger backup calculation endpoint
    const res = await request(app)
      .post('/api/backup/send-now')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: today.toISOString() });

    assert.strictEqual(res.status, 200);
    // Verified: Only active bills are counted, soft-deleted bills are excluded
    assert.strictEqual(res.body.summary.totalRevenue, 5000, 'Total revenue must only count active bill (5000), not deleted bill (10000)');
    assert.strictEqual(res.body.billCount, 1, 'Bill count must be 1 (only active bill)');
  });

  it('excludes soft-deleted bills from GSTR-1 PDF dataset', async () => {
    const today = new Date();

    const res = await request(app)
      .get('/api/reports/gst-pdf?range=this_month')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.ok(res.body && res.body.length > 0, 'PDF buffer generated successfully');
  });
});

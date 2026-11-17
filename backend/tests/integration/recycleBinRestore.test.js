const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/srsf_test_suite';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_production_readiness_32b';

const app = require('../../src/app');
const User = require('../../src/models/User');
const Bill = require('../../src/models/Bill');

describe('Recycle Bin Restore Business Rules Integration Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Recycle Bin Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /recycle-admin/ });

    adminUser = await User.create({
      name: 'Recycle Admin',
      username: 'recycle_admin',
      email: 'recycle-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Recycle Bin Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /recycle-admin/ });
    await mongoose.disconnect();
  });

  it('restores soft-deleted bill when original slot is free', async () => {
    const bill = await Bill.create({
      billNo: -77701,
      originalBillNo: 77701,
      formattedBillNo: 'VDA/77701',
      companyName: 'Recycle Bin Test Free Slot',
      companyGstin: '37ABCDE1234F1Z5',
      quantity: 10,
      rate: 100,
      total: 1000,
      grandTotal: 1000,
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: adminUser._id,
      deletedReason: 'Temporary deletion test',
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/recycle-bin/restore/bill/${bill._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bill.billNo, 77701);
    assert.strictEqual(res.body.bill.isDeleted, false);

    const check = await Bill.findById(bill._id);
    assert.strictEqual(check.billNo, 77701);
    assert.strictEqual(check.isDeleted, false);
  });

  it('blocks restore when original bill number slot is already occupied', async () => {
    // 1. Create an active bill #77702
    await Bill.create({
      billNo: 77702,
      formattedBillNo: 'VDA/77702',
      companyName: 'Recycle Bin Test Active Owner',
      companyGstin: '37ABCDE1234F1Z5',
      quantity: 10,
      rate: 100,
      total: 1000,
      grandTotal: 1000,
      isDeleted: false,
      createdBy: adminUser._id,
    });

    // 2. Create a deleted bill whose originalBillNo was also 77702
    const deletedBill = await Bill.create({
      billNo: -77702,
      originalBillNo: 77702,
      formattedBillNo: 'VDA/77702',
      companyName: 'Recycle Bin Test Conflicting Deleted',
      companyGstin: '37ABCDE1234F1Z5',
      quantity: 10,
      rate: 100,
      total: 1000,
      grandTotal: 1000,
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: adminUser._id,
      deletedReason: 'Conflicting slot test',
      createdBy: adminUser._id,
    });

    // 3. Attempt restore -> should be rejected with 409 Conflict
    const res = await request(app)
      .post(`/api/recycle-bin/restore/bill/${deletedBill._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /already occupied/i);
    assert.match(res.body.message, /Re-numbering an issued invoice is prohibited/i);

    // Verify deleted bill remained deleted and did not get re-numbered
    const check = await Bill.findById(deletedBill._id);
    assert.strictEqual(check.isDeleted, true);
    assert.strictEqual(check.billNo, -77702);
  });
});

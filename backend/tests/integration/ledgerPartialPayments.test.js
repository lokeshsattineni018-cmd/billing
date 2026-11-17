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

describe('Customer Ledger Partial Payments Integration Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Partial Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /ledger-test-admin/ });

    adminUser = await User.create({
      name: 'Ledger Admin',
      username: 'ledger_admin',
      email: 'ledger-test-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create 3 bills for 'Ledger Partial Test Buyer':
    // 1. Fully Paid bill: total = 50000, paidAmount = 50000, paymentStatus = 'Paid'
    // 2. Partially Paid bill: total = 100000, paidAmount = 40000, paymentStatus = 'Partial'
    // 3. Pending bill: total = 30000, paidAmount = 0, paymentStatus = 'Pending'
    await Bill.create([
      {
        billNo: 99901,
        companyName: 'Ledger Partial Test Buyer',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 100,
        rate: 500,
        total: 50000,
        grandTotal: 50000,
        paidAmount: 50000,
        paymentStatus: 'Paid',
        isVoided: false,
        isDeleted: false,
        createdBy: adminUser._id,
      },
      {
        billNo: 99902,
        companyName: 'Ledger Partial Test Buyer',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 200,
        rate: 500,
        total: 100000,
        grandTotal: 100000,
        paidAmount: 40000,
        paymentStatus: 'Partial',
        isVoided: false,
        isDeleted: false,
        createdBy: adminUser._id,
      },
      {
        billNo: 99903,
        companyName: 'Ledger Partial Test Buyer',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 60,
        rate: 500,
        total: 30000,
        grandTotal: 30000,
        paidAmount: 0,
        paymentStatus: 'Pending',
        isVoided: false,
        isDeleted: false,
        createdBy: adminUser._id,
      },
    ]);
  });

  after(async () => {
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Partial Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /ledger-test-admin/ });
    await mongoose.disconnect();
  });

  it('correctly aggregates paidAmount and outstandingBalance for partial payments in /api/bills/ledger', async () => {
    const res = await request(app)
      .get('/api/bills/ledger')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const customer = res.body.customers.find((c) => c.companyName === 'Ledger Partial Test Buyer');
    assert.ok(customer, 'Customer should exist in ledger');

    // Total invoiced: 50,000 + 100,000 + 30,000 = 180,000
    assert.strictEqual(customer.totalInvoiced, 180000);

    // Total paid: 50,000 (Paid) + 40,000 (Partial) + 0 (Pending) = 90,000
    assert.strictEqual(customer.totalPaid, 90000);

    // Outstanding: 0 (Paid) + 60,000 (Partial remaining) + 30,000 (Pending) = 90,000
    assert.strictEqual(customer.outstandingBalance, 90000);

    // Total bills: 3, Unpaid bills count: 2 (Partial + Pending)
    assert.strictEqual(customer.totalBills, 3);
    assert.strictEqual(customer.unpaidBillsCount, 2);
  });
});

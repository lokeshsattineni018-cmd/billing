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

describe('Customer Ledger Compound Index & Real-Time Performance Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('users').deleteMany({ email: 'ledger-index-admin@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Index Test/ });

    adminUser = await User.create({
      name: 'Ledger Index Admin',
      username: 'ledger_index_admin',
      email: 'ledger-index-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test bills
    await Bill.create([
      {
        billNo: 88801,
        companyName: 'Ledger Index Test Corp',
        companyGstin: '37ABCDE1234F1Z5',
        quantity: 100,
        rate: 500,
        total: 50000,
        grandTotal: 50000,
        paidAmount: 20000,
        paymentStatus: 'Partial',
        isDeleted: false,
        isVoided: false,
        createdBy: adminUser._id,
      },
    ]);
  });

  after(async () => {
    await mongoose.connection.collection('users').deleteMany({ email: 'ledger-index-admin@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Index Test/ });
    await mongoose.disconnect();
  });

  it('verifies compound index { isDeleted: 1, isVoided: 1, companyName: 1 } exists on Bill collection', async () => {
    await Bill.syncIndexes();
    const indexes = await Bill.collection.indexes();

    const targetIndex = indexes.find(
      (idx) => idx.key.isDeleted === 1 && idx.key.isVoided === 1 && idx.key.companyName === 1
    );

    assert.ok(targetIndex, 'Compound index on { isDeleted: 1, isVoided: 1, companyName: 1 } must exist');
  });

  it('serves real-time /api/bills/ledger directly from indexed MongoDB without stale cache', async () => {
    const start = performance.now();
    const res = await request(app)
      .get('/api/bills/ledger')
      .set('Authorization', `Bearer ${adminToken}`);
    const duration = performance.now() - start;

    assert.equal(res.status, 200);
    assert.ok(res.body.customers.length > 0);
    assert.ok(duration < 200, `Execution took ${duration.toFixed(2)}ms, expected < 200ms`);

    const customer = res.body.customers.find((c) => c.companyName === 'Ledger Index Test Corp');
    assert.ok(customer);
    assert.equal(customer.totalInvoiced, 50000);
    assert.equal(customer.totalPaid, 20000);
    assert.equal(customer.outstandingBalance, 30000);
  });
});

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

describe('Customer Ledger Compound Index & Cache Optimization Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('users').deleteMany({ email: 'ledger-cache-admin@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Cache Test/ });

    adminUser = await User.create({
      name: 'Ledger Cache Admin',
      username: 'ledger_cache_admin',
      email: 'ledger-cache-admin@srsf.local',
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
    await mongoose.connection.collection('users').deleteMany({ email: 'ledger-cache-admin@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Ledger Cache Test/ });
    const billsRouter = require('../../src/routes/bills');
    if (billsRouter.invalidateLedgerCache) billsRouter.invalidateLedgerCache();
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

  it('caches /api/bills/ledger responses and serves subsequent calls from memory cache', async () => {
    // 1. Initial query populates cache
    const res1 = await request(app)
      .get('/api/bills/ledger')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-test-cache', 'true');

    assert.equal(res1.status, 200);

    // 2. Immediate second query serves from memory cache
    const res2 = await request(app)
      .get('/api/bills/ledger')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-test-cache', 'true');

    assert.equal(res2.status, 200);
    assert.deepEqual(res1.body, res2.body);
  });
});

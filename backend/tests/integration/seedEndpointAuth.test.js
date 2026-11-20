process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
process.env.JWT_SECRET = 'test_jwt_secret_key_production_readiness_32b';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { getJwtSecret } = require('../../src/middleware/security');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
const TEST_SEED_SECRET = 'test-staging-seed-secret-xyz987';

describe('POST /api/auth/seed SEED_SECRET Protection Tests', () => {
  let adminToken;
  let staffToken;
  let adminUser;
  let staffUser;
  const originalSeedSecret = process.env.SEED_SECRET;

  before(async () => {
    process.env.SEED_SECRET = TEST_SEED_SECRET;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    // Start with 0 users in test DB
    await User.deleteMany({});
  });

  after(async () => {
    process.env.SEED_SECRET = originalSeedSecret;
    await User.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('rejects POST /api/auth/seed with 401 when database is empty and SEED_SECRET header is missing', async () => {
    const res = await request(app).post('/api/auth/seed');
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.message, /SEED_SECRET/i);
  });

  it('rejects POST /api/auth/seed with 401 when database is empty and invalid SEED_SECRET is provided', async () => {
    const res = await request(app)
      .post('/api/auth/seed')
      .set('x-seed-secret', 'wrong-secret-value');
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.message, /SEED_SECRET/i);
  });

  it('seeds default users with 200 when database is empty and valid SEED_SECRET header is provided', async () => {
    const res = await request(app)
      .post('/api/auth/seed')
      .set('x-seed-secret', TEST_SEED_SECRET);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, 'Default accounts initialized successfully');

    // Confirm users now exist
    adminUser = await User.findOne({ username: 'lokesh18' });
    staffUser = await User.findOne({ username: 'staff' });
    assert.ok(adminUser, 'Admin user should be seeded');
    assert.ok(staffUser, 'Staff user should be seeded');

    const secret = getJwtSecret();
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role, tokenVersion: 0 }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: staffUser._id, role: staffUser.role, tokenVersion: 0 }, secret, { expiresIn: '1h' });
  });

  it('rejects re-seeding when accounts already exist and valid admin token is missing', async () => {
    // Has correct seed secret, but accounts already exist and no JWT provided
    const res = await request(app)
      .post('/api/auth/seed')
      .set('x-seed-secret', TEST_SEED_SECRET);

    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.message, /Admin authentication required/i);
  });

  it('rejects re-seeding with 403 when called by non-admin staff role', async () => {
    const res = await request(app)
      .post('/api/auth/seed')
      .set('x-seed-secret', TEST_SEED_SECRET)
      .set('Authorization', `Bearer ${staffToken}`);

    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.message, /Only owner or admin/i);
  });

  it('permits re-seeding with 200 when both valid SEED_SECRET and admin JWT are provided', async () => {
    const res = await request(app)
      .post('/api/auth/seed')
      .set('x-seed-secret', TEST_SEED_SECRET)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, 'Default accounts initialized successfully');
  });
});

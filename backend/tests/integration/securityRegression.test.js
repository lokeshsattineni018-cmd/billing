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

describe('Security Regression Tests (CORS, IDOR & Access Control)', () => {
  let staffToken;
  let adminToken;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Clean test database
    await mongoose.connection.collection('users').deleteMany({ email: /test-security/ });

    // Seed test users
    const staff = await User.create({
      name: 'Security Test Staff',
      username: 'test_staff_sec',
      email: 'test-security-staff@srsf.local',
      password: 'password123',
      role: 'staff',
    });

    const admin = await User.create({
      name: 'Security Test Admin',
      username: 'test_admin_sec',
      email: 'test-security-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    staffToken = jwt.sign(
      { id: staff._id, role: staff.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: admin._id, role: admin.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    await mongoose.connection.collection('users').deleteMany({ email: /test-security/ });
    await mongoose.disconnect();
  });

  describe('CORS Whitelist Protection', () => {
    it('allows requests from production client URL', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://billing-snowy-three.vercel.app');

      assert.strictEqual(res.headers['access-control-allow-origin'], 'https://billing-snowy-three.vercel.app');
      assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    });

    it('allows requests from local development frontend', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });

    it('allows requests from Vercel preview deployment pattern', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://billing-preview-pr12-lokeshsattinenis-projects.vercel.app');

      assert.strictEqual(res.headers['access-control-allow-origin'], 'https://billing-preview-pr12-lokeshsattinenis-projects.vercel.app');
    });

    it('blocks unauthorized origin from receiving access-control-allow-origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker-site.com');

      // Unauthorized origin must NOT be reflected in CORS allow header
      assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://malicious-attacker-site.com');
    });
  });

  describe('IDOR & Public Endpoint Enumeration Protection', () => {
    it('strictly blocks sequential integer enumeration attacks on /api/bills/public/:token', async () => {
      // Attacker trying sequential invoice IDs 1, 2, 3
      const res1 = await request(app).get('/api/bills/public/1');
      assert.strictEqual(res1.status, 404);
      assert.match(res1.body.message, /invalid access token|not found/i);

      const res2 = await request(app).get('/api/bills/public/2');
      assert.strictEqual(res2.status, 404);

      const res99 = await request(app).get('/api/bills/public/9999');
      assert.strictEqual(res99.status, 404);
    });

    it('strictly blocks integer enumeration on public PDF endpoint /api/bills/public/:token/pdf', async () => {
      const res = await request(app).get('/api/bills/public/1/pdf');
      assert.strictEqual(res.status, 404);
    });

    it('returns 404 for arbitrary invalid string tokens', async () => {
      const res = await request(app).get('/api/bills/public/nonexistent-random-token-xyz');
      assert.strictEqual(res.status, 404);
    });
  });

  describe('Role-Based Access Control (RBAC) & Protected Routes', () => {
    it('blocks unauthenticated requests to protected endpoints', async () => {
      const res = await request(app).get('/api/bills');
      assert.strictEqual(res.status, 401);
    });

    it('blocks staff role from accessing confidential Customer Ledger', async () => {
      const res = await request(app)
        .get('/api/bills/ledger')
        .set('Authorization', `Bearer ${staffToken}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /permission/i);
    });

    it('allows admin role to access Customer Ledger', async () => {
      const res = await request(app)
        .get('/api/bills/ledger')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.customers));
    });

    it('blocks staff role from accessing User Management', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);

      assert.strictEqual(res.status, 403);
    });
  });

  describe('Backup Secret & Observability Hardening', () => {
    before(() => {
      process.env.CRON_SECRET = 'ci_cron_secret_test_32b_secure';
      process.env.HEALTH_SECRET = 'ci_health_secret_test_key_secure';
    });

    it('rejects backup requests with query parameter secret (?secret=)', async () => {
      const res = await request(app)
        .get('/api/backup/daily-summary?secret=ci_cron_secret_test_32b_secure');

      assert.strictEqual(res.status, 401);
      assert.match(res.body.message, /Provide valid X-Cron-Secret header/i);
    });

    it('rejects backup requests with invalid X-Cron-Secret header', async () => {
      const res = await request(app)
        .get('/api/backup/daily-summary')
        .set('X-Cron-Secret', 'invalid_fake_secret');

      assert.strictEqual(res.status, 401);
    });

    it('allows public JSON /api/health endpoint for external uptime monitors without credentials', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.service, 'srsf-billing-backend');
      assert.strictEqual(res.body.status, 'ok');
    });

    it('blocks /api/health?format=html without credentials with 401 and WWW-Authenticate', async () => {
      const res = await request(app).get('/api/health?format=html');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.headers['www-authenticate'], 'Basic realm="SRSF Health Dashboard"');
      assert.match(res.text, /Protected Dashboard/i);
    });

    it('allows /api/health?format=html with valid X-Health-Secret header', async () => {
      const res = await request(app)
        .get('/api/health?format=html')
        .set('X-Health-Secret', 'ci_health_secret_test_key_secure');

      assert.strictEqual(res.status, 200);
      assert.match(res.headers['content-type'], /html/);
      assert.match(res.text, /Vijaya Durga Agencies/);
    });

    it('allows /api/health?format=html with valid HTTP Basic Auth credentials', async () => {
      const basicCredentials = Buffer.from('admin:ci_health_secret_test_key_secure').toString('base64');
      const res = await request(app)
        .get('/api/health?format=html')
        .set('Authorization', `Basic ${basicCredentials}`);

      assert.strictEqual(res.status, 200);
      assert.match(res.headers['content-type'], /html/);
      assert.match(res.text, /API & Database Health Monitor/);
    });
  });

  describe('Password Reset Token Invalidation ($inc tokenVersion)', () => {
    it('increments tokenVersion on reset, invalidating all previous JWT tokens', async () => {
      const user = await User.create({
        name: 'Reset Test User',
        username: 'reset_user_test',
        password: 'initialpassword123',
        role: 'staff',
        tokenVersion: 5,
      });

      const oldToken = jwt.sign(
        { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Verify token works initially
      const resBefore = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${oldToken}`);
      assert.strictEqual(resBefore.status, 200);

      // Perform atomic password reset with $inc: { tokenVersion: 1 }
      await User.updateOne(
        { _id: user._id },
        {
          $set: { password: 'newSecurePassword2026' },
          $inc: { tokenVersion: 1 },
        }
      );

      const refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser.tokenVersion, 6, 'tokenVersion should increment from 5 to 6');

      // The old token with tokenVersion 5 MUST now be rejected with 401
      const resAfter = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${oldToken}`);

      assert.strictEqual(resAfter.status, 401);
      assert.match(resAfter.body.message, /Session expired or logged out/i);

      // Clean up
      await User.deleteOne({ _id: user._id });
    });
  });

  describe('Error Sanitization & Zero Debug Leakage in Production', () => {
    it('returns only generic message on 500 error in production mode, with zero stack traces or DB internals', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        // Intentionally trigger a 500 by mocking Bill.aggregate to throw an internal error
        const Bill = require('../../src/models/Bill');
        const origAggregate = Bill.aggregate;
        Bill.aggregate = () => {
          throw new Error('Mongoose: connection refused 127.0.0.1:27017 at internal/db/query.js:142');
        };

        const res = await request(app)
          .get('/api/bills/ledger')
          .set('Authorization', `Bearer ${adminToken}`);

        // Restore immediately
        Bill.aggregate = origAggregate;

        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.message, 'Server error');
        assert.strictEqual(res.body.error, undefined, 'Must not leak error property');
        assert.strictEqual(res.body.stack, undefined, 'Must not leak stack property');
        assert.strictEqual(JSON.stringify(res.body).includes('Mongoose'), false, 'Must not leak Mongoose internals');
        assert.strictEqual(JSON.stringify(res.body).includes('127.0.0.1'), false, 'Must not leak IP or file paths');

        // Verify headers
        assert.strictEqual(res.headers['x-powered-by'], undefined, 'Must not leak X-Powered-By');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('centralized Express error handler returns only generic message in production', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        // Trigger an unexpected exception by calling a route with a mocked failure
        const Settings = require('../../src/models/Settings');
        const origFindOne = Settings.findOne;
        Settings.findOne = () => {
          throw new TypeError('Cannot read properties of undefined (reading secretKey)');
        };

        const res = await request(app)
          .get('/api/settings')
          .set('Authorization', `Bearer ${adminToken}`);

        Settings.findOne = origFindOne;

        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.message, 'Server error');
        assert.strictEqual(res.body.error, undefined);
        assert.strictEqual(res.body.stack, undefined);
        assert.strictEqual(JSON.stringify(res.body).includes('secretKey'), false);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });
});


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

describe('Combined Dashboard Endpoint Integration Tests (/api/dashboard/combined)', () => {
  let adminToken;
  let adminUser;
  let staffToken;
  let staffUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Combined Dash Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /combined-dash/ });

    adminUser = await User.create({
      name: 'Combined Dash Admin',
      username: 'cd_admin',
      email: 'combined-dash-admin@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    staffUser = await User.create({
      name: 'Combined Dash Staff',
      username: 'cd_staff',
      email: 'combined-dash-staff@srsf.local',
      password: 'password123',
      role: 'staff',
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    staffToken = jwt.sign(
      { id: staffUser._id, role: staffUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const now = new Date();

    // 1. Valid Active Bill
    await Bill.create({
      billNo: 8101,
      companyName: 'Combined Dash Test Active',
      companyGstin: '37AAAAA0000A1Z5',
      quantity: 20,
      rate: 600,
      total: 12000,
      grandTotal: 12000,
      paidAmount: 5000,
      paymentStatus: 'Partial',
      date: now,
      isVoided: false,
      isDeleted: false,
    });

    // 2. Voided Bill (Must be completely excluded from metrics)
    await Bill.create({
      billNo: 8102,
      companyName: 'Combined Dash Test Voided',
      companyGstin: '37BBBBB1111B1Z5',
      quantity: 50,
      rate: 1000,
      total: 50000,
      grandTotal: 50000,
      paidAmount: 0,
      paymentStatus: 'Pending',
      date: now,
      isVoided: true,
      voidReason: 'Mistake in weight',
      isDeleted: false,
    });

    // 3. Soft-Deleted Bill (Must be completely excluded from metrics)
    await Bill.create({
      billNo: 8103,
      companyName: 'Combined Dash Test Deleted',
      companyGstin: '37CCCCC2222C1Z5',
      quantity: 30,
      rate: 800,
      total: 24000,
      grandTotal: 24000,
      paidAmount: 0,
      paymentStatus: 'Pending',
      date: now,
      isVoided: false,
      isDeleted: true,
    });
  });

  after(async () => {
    try {
      await mongoose.connection.collection('bills').deleteMany({ companyName: /Combined Dash Test/ });
      await mongoose.connection.collection('users').deleteMany({ email: /combined-dash/ });
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });

  it('rejects unauthenticated requests to /api/dashboard/combined with 401', async () => {
    const res = await request(app).get('/api/dashboard/combined');
    assert.equal(res.status, 401);
  });

  it('strictly rejects staff requests with 403 Forbidden for revenue and balances', async () => {
    const res = await request(app)
      .get('/api/dashboard/combined')
      .set('Authorization', `Bearer ${staffToken}`);

    assert.equal(res.status, 403);
    assert.match(res.body.message, /permission/i);
  });

  it('returns consolidated summary and analytics for Admin while strictly excluding voided and deleted bills', async () => {
    const res = await request(app)
      .get('/api/dashboard/combined')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.summary, 'Must contain summary block');
    assert.ok(res.body.analytics, 'Must contain analytics block');

    const { summary, analytics } = res.body;

    // Verify summary structure
    assert.ok(summary.selectedPeriod);
    assert.ok(summary.today);
    assert.ok(summary.month);
    assert.ok(summary.receivables);

    // Exclusion assertions:
    // Only the 1 active bill (₹12,000) should be in today's sales; voided (50k) and deleted (24k) must be excluded
    assert.equal(summary.today.totalSales, 12000, 'Today sales must only include active bills');
    assert.equal(summary.today.billCount, 1, 'Today bill count must only include active bills');

    // Receivables must reflect 12000 - 5000 = 7000, excluding voided (50k) and deleted (24k)
    assert.equal(summary.receivables.totalPending, 7000, 'Receivables must exclude voided and deleted bills');

    // Recent bills list must NOT contain voided or deleted bills
    const recentCompanyNames = summary.recentBills.map(b => b.companyName);
    assert.ok(recentCompanyNames.includes('Combined Dash Test Active'));
    assert.ok(!recentCompanyNames.includes('Combined Dash Test Voided'), 'Recent bills must not include voided bills');
    assert.ok(!recentCompanyNames.includes('Combined Dash Test Deleted'), 'Recent bills must not include deleted bills');

    // Analytics: top customers must not list voided or deleted customers
    const topCustomerNames = analytics.topCustomers.map(c => c.name);
    assert.ok(!topCustomerNames.includes('Combined Dash Test Voided'));
    assert.ok(!topCustomerNames.includes('Combined Dash Test Deleted'));
  });
});

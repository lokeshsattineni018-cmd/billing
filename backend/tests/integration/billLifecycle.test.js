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
const Settings = require('../../src/models/Settings');
const Bill = require('../../src/models/Bill');

describe('Full Bill Lifecycle Integration Tests', () => {
  let adminToken;
  let adminUser;
  let createdBillId;
  let createdBillNo;
  let shareToken;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Clean test collection
    await mongoose.connection.collection('users').deleteMany({ email: /test-lifecycle/ });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Lifecycle Test Customer/ });

    // Ensure business settings with GSTIN exist
    await Settings.findOneAndUpdate(
      {},
      {
        businessName: 'VIJAYA DURGA SEA FOODS',
        gstin: '37ABCDE1234F1Z5',
        phone: '9848012345',
        invoicePrefix: 'VDA/',
      },
      { upsert: true, new: true }
    );

    // Create admin user
    adminUser = await User.create({
      name: 'Lifecycle Admin',
      username: 'lifecycle_admin',
      email: 'test-lifecycle-admin@srsf.local',
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
    await mongoose.connection.collection('users').deleteMany({ email: /test-lifecycle/ });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Lifecycle Test Customer/ });
    await mongoose.disconnect();
  });

  it('Step 1: Creates a new bill with server-calculated totals and shareToken', async () => {
    const payload = {
      companyName: 'Lifecycle Test Customer Enterprises',
      customerPhone: '9849012345',
      items: [
        {
          particulars: 'Vannamei Prawns 30 Count',
          hsn: '0306',
          quantity: 150,
          rate: 400,
        },
      ],
      cgstAmount: 1500,
      sgstAmount: 1500,
      total: 60000,
      grandTotal: 63000,
      paymentStatus: 'Pending',
    };

    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body._id, 'Bill _id should exist');
    assert.ok(typeof res.body.billNo === 'number', 'billNo should be numeric');
    assert.match(res.body.formattedBillNo, /^VDA\/\d{4}$/, 'formattedBillNo should have VDA/ prefix');
    assert.strictEqual(res.body.total, 60000);
    assert.strictEqual(res.body.grandTotal, 63000);
    assert.strictEqual(res.body.paymentStatus, 'Pending');
    assert.strictEqual(res.body.isVoided, false);
    assert.ok(res.body.shareToken && res.body.shareToken.length === 32, 'shareToken should be 32 hex chars');

    createdBillId = res.body._id;
    createdBillNo = res.body.billNo;
    shareToken = res.body.shareToken;
  });

  it('Step 2: Edits the bill (updates quantities and triggers server-side recalculation)', async () => {
    assert.ok(createdBillId, 'Bill ID must be present');

    const updatePayload = {
      companyName: 'Lifecycle Test Customer Enterprises',
      items: [
        {
          particulars: 'Vannamei Prawns 30 Count',
          hsn: '0306',
          quantity: 200, // Increased from 150 to 200
          rate: 400,
        },
      ],
      cgstAmount: 2000, // 200 * 400 = 80,000; 2.5% = 2,000
      sgstAmount: 2000,
    };

    const res = await request(app)
      .put(`/api/bills/${createdBillId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatePayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items[0].quantity, 200);
    assert.strictEqual(res.body.items[0].amount, 80000);
    assert.strictEqual(res.body.total, 80000);
    assert.strictEqual(res.body.grandTotal, 84000);
  });

  it('Step 3: Updates payment status to Paid', async () => {
    assert.ok(createdBillId, 'Bill ID must be present');

    const res = await request(app)
      .patch(`/api/bills/${createdBillId}/payment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentStatus: 'Paid' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.paymentStatus, 'Paid');

    // Confirm persisted in database
    const dbBill = await Bill.findById(createdBillId);
    assert.strictEqual(dbBill.paymentStatus, 'Paid');
  });

  it('Step 4a: Generates authenticated PDF with valid binary stream', async () => {
    assert.ok(createdBillId, 'Bill ID must be present');

    const res = await request(app)
      .get(`/api/bills/${createdBillId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        res.data = [];
        res.on('data', (chunk) => res.data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(res.data)));
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.ok(res.body.length > 1000, 'PDF buffer should exceed 1000 bytes');
    // PDF Magic number %PDF-
    assert.strictEqual(res.body.slice(0, 5).toString('ascii'), '%PDF-');
  });

  it('Step 4b: Generates public customer PDF via cryptographic shareToken', async () => {
    assert.ok(shareToken, 'shareToken must be present');

    const res = await request(app)
      .get(`/api/bills/public/${shareToken}/pdf`)
      .buffer(true)
      .parse((res, callback) => {
        res.data = [];
        res.on('data', (chunk) => res.data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(res.data)));
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.ok(res.body.length > 1000);
    assert.strictEqual(res.body.slice(0, 5).toString('ascii'), '%PDF-');
  });

  it('Step 5: Voids the bill with explicit audit reason', async () => {
    assert.ok(createdBillId, 'Bill ID must be present');

    const res = await request(app)
      .patch(`/api/bills/${createdBillId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Quality inspection rejection at loading' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.bill.isVoided, true);
    assert.strictEqual(res.body.bill.voidReason, 'Quality inspection rejection at loading');
    assert.ok(res.body.bill.voidedAt);
  });

  it('Step 6: Enforces strict post-void business invariants', async () => {
    assert.ok(createdBillId, 'Bill ID must be present');

    // 1. Cannot re-void an already voided bill
    const reVoidRes = await request(app)
      .patch(`/api/bills/${createdBillId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Attempt duplicate void' });
    assert.strictEqual(reVoidRes.status, 400);
    assert.match(reVoidRes.body.message, /already voided/i);

    // 2. Cannot edit a voided bill
    const editRes = await request(app)
      .put(`/api/bills/${createdBillId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Attempted Change' });
    assert.strictEqual(editRes.status, 400);
    assert.match(editRes.body.message, /cannot edit a voided invoice/i);

    // 3. Cannot change payment status of a voided bill
    const paymentRes = await request(app)
      .patch(`/api/bills/${createdBillId}/payment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentStatus: 'Pending' });
    assert.strictEqual(paymentRes.status, 400);
    assert.match(paymentRes.body.message, /cannot change payment status of a voided invoice/i);
  });
});

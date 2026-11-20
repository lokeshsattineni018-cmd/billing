const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
process.env.JWT_SECRET = 'test_jwt_secret_key_production_readiness_32b';

const app = require('../../src/app');
const User = require('../../src/models/User');
const Bill = require('../../src/models/Bill');
const ConsumedNonce = require('../../src/models/ConsumedNonce');

describe('PDF Ticket, MongoDB TTL & Query-Param Auth Security Integration Tests', () => {
  let authToken;
  let testUser;
  let testBill;
  let anotherBill;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('users').deleteMany({ email: 'pdftest@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /PDF Security Customer/ });
    await ConsumedNonce.deleteMany({});
    await ConsumedNonce.syncIndexes();

    testUser = await User.create({
      name: 'PDF Auth Tester',
      username: 'pdf_auth_tester',
      email: 'pdftest@srsf.local',
      password: 'password123',
      role: 'admin',
    });

    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    testBill = await Bill.create({
      billNo: 99881,
      date: new Date(),
      companyName: 'PDF Security Customer 1',
      companyGstin: '37ABCDE1234F1Z5',
      customerAddress: 'Secunderabad',
      quantity: 90,
      rate: 500,
      items: [
        {
          particulars: 'HEAD-ON PRAWNS',
          boxes: 5,
          grossWeight: 100,
          tareWeight: 10,
          netWeight: 90,
          quantity: 90,
          rate: 500,
          amount: 45000,
        },
      ],
      totalWeight: 90,
      total: 45000,
      grandTotal: 45000,
      paymentStatus: 'Pending',
      paidAmount: 0,
      outstandingBalance: 45000,
      createdBy: testUser._id,
    });

    anotherBill = await Bill.create({
      billNo: 99882,
      date: new Date(),
      companyName: 'PDF Security Customer 2',
      companyGstin: '37ABCDE1234F1Z5',
      customerAddress: 'Visakhapatnam',
      quantity: 50,
      rate: 400,
      items: [
        {
          particulars: 'HEAD-ON PRAWNS',
          boxes: 2,
          grossWeight: 55,
          tareWeight: 5,
          netWeight: 50,
          quantity: 50,
          rate: 400,
          amount: 20000,
        },
      ],
      totalWeight: 50,
      total: 20000,
      grandTotal: 20000,
      paymentStatus: 'Pending',
      paidAmount: 0,
      outstandingBalance: 20000,
      createdBy: testUser._id,
    });
  });

  after(async () => {
    await mongoose.connection.collection('users').deleteMany({ email: 'pdftest@srsf.local' });
    await mongoose.connection.collection('bills').deleteMany({ companyName: /PDF Security Customer/ });
    await ConsumedNonce.deleteMany({});
    await mongoose.disconnect();
  });

  it('creates and verifies the MongoDB TTL and unique indexes on ConsumedNonce', async () => {
    await ConsumedNonce.syncIndexes();
    const indexes = await ConsumedNonce.collection.indexes();

    const ttlIndex = indexes.find((idx) => idx.key.createdAt === 1);
    assert.ok(ttlIndex, 'TTL index on createdAt must exist');
    assert.equal(ttlIndex.expireAfterSeconds, 120, 'TTL index must expire documents after 120 seconds');

    const nonceIndex = indexes.find((idx) => idx.key.nonce === 1);
    assert.ok(nonceIndex, 'Index on nonce must exist');
    assert.equal(nonceIndex.unique, true, 'Nonce index must be unique for distributed replay prevention');
  });

  it('rejects GET /api/bills/:id/pdf with ?token= query parameter', async () => {
    const res = await request(app)
      .get(`/api/bills/${testBill._id}/pdf?token=${authToken}`);

    assert.equal(res.status, 401);
    assert.match(res.text, /Query parameter authentication \(\?token=\) is disabled/);
  });

  it('rejects general API routes with ?token= query parameter in protect middleware', async () => {
    const res = await request(app)
      .get(`/api/bills?token=${authToken}`);

    assert.equal(res.status, 401);
    assert.match(res.body.message, /Token in query parameters \(\?token=\) is disabled/);
  });

  it('allows authenticated users to generate a short-lived single-use PDF ticket', async () => {
    const res = await request(app)
      .post(`/api/bills/${testBill._id}/pdf-ticket`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.ticket);
    assert.ok(res.body.downloadUrl.includes(`ticket=${res.body.ticket}`));
    assert.equal(res.body.expiresIn, 60);
  });

  it('enforces single-use via ConsumedNonce: first use succeeds, second use fails', async () => {
    const ticketRes = await request(app)
      .post(`/api/bills/${testBill._id}/pdf-ticket`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(ticketRes.status, 200);
    const ticket = ticketRes.body.ticket;

    // 1. First use succeeds
    const pdfRes = await request(app)
      .get(`/api/bills/${testBill._id}/pdf?ticket=${ticket}`);

    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers['content-type'], 'application/pdf');

    // Verify nonce document was atomically persisted in MongoDB
    const decoded = jwt.decode(ticket);
    const consumedDoc = await ConsumedNonce.findOne({ nonce: decoded.nonce });
    assert.ok(consumedDoc, 'ConsumedNonce document must exist in MongoDB');
    assert.equal(consumedDoc.billId.toString(), testBill._id.toString());
    assert.equal(consumedDoc.userId.toString(), testUser._id.toString());

    // 2. Second use fails (E11000 duplicate key caught and returned as 401)
    const reuseRes = await request(app)
      .get(`/api/bills/${testBill._id}/pdf?ticket=${ticket}`);

    assert.equal(reuseRes.status, 401);
    assert.match(reuseRes.text, /download ticket has already been used/);
  });

  it('rejects a download ticket used for a different bill (mismatched billId)', async () => {
    const ticketRes = await request(app)
      .post(`/api/bills/${testBill._id}/pdf-ticket`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(ticketRes.status, 200);
    const ticket = ticketRes.body.ticket;

    // Attempt to download anotherBill using testBill's ticket
    const mismatchRes = await request(app)
      .get(`/api/bills/${anotherBill._id}/pdf?ticket=${ticket}`);

    assert.equal(mismatchRes.status, 401);
    assert.match(mismatchRes.text, /invalid ticket scope or mismatched bill/);
  });

  it('rejects an expired download ticket', async () => {
    // Generate an already expired ticket (-5s)
    const expiredTicket = jwt.sign(
      {
        purpose: 'pdf-download',
        billId: testBill._id.toString(),
        userId: testUser._id.toString(),
        nonce: crypto.randomBytes(12).toString('hex'),
      },
      process.env.JWT_SECRET,
      { expiresIn: '-5s' }
    );

    const expiredRes = await request(app)
      .get(`/api/bills/${testBill._id}/pdf?ticket=${expiredTicket}`);

    assert.equal(expiredRes.status, 401);
    assert.match(expiredRes.text, /download ticket has expired/);
  });

  it('allows downloading PDF with standard Bearer authorization header', async () => {
    const res = await request(app)
      .get(`/api/bills/${testBill._id}/pdf`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });
});

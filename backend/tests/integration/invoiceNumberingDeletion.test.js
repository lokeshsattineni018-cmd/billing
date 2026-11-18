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
const { Counter, resetSequence } = require('../../src/models/Counter');

describe('Invoice Numbering & Deletion Business Rules Integration Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Invoice Numbering Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /inv-num-admin/ });

    adminUser = await User.create({
      name: 'Invoice Admin',
      username: 'inv_admin',
      email: 'inv-num-admin@srsf.local',
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
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Invoice Numbering Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /inv-num-admin/ });
    await mongoose.disconnect();
  });

  it('Case 1: Deleting HIGHEST bill allows next bill to reuse that exact number', async () => {
    // Setup bills #101, #102
    await resetSequence('billNo', 100);

    const b1 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C1',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });
    assert.strictEqual(b1.status, 201);
    assert.strictEqual(b1.body.billNo, 101);

    const b2 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C1',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });
    assert.strictEqual(b2.status, 201);
    assert.strictEqual(b2.body.billNo, 102);

    // Delete highest bill (#102)
    const delRes = await request(app)
      .delete(`/api/bills/${b2.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmationCode: 'DELETE', reason: 'Highest bill mistake' });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.nextInvoiceNo, 102);

    // Create a new bill - must reuse #102
    const b3 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C1',
        items: [{ particulars: 'Prawns', quantity: 15, rate: 100 }],
      });
    assert.strictEqual(b3.status, 201);
    assert.strictEqual(b3.body.billNo, 102, 'Next bill should reuse #102');
  });

  it('Case 2: Deleting a MIDDLE bill does NOT renumber anything; counter continues forward', async () => {
    // Setup bills #201, #202, #203
    await resetSequence('billNo', 200);

    const b1 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C2',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });
    const b2 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C2',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });
    const b3 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C2',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });

    assert.strictEqual(b1.body.billNo, 201);
    assert.strictEqual(b2.body.billNo, 202);
    assert.strictEqual(b3.body.billNo, 203);

    // Delete middle bill (#202)
    const delRes = await request(app)
      .delete(`/api/bills/${b2.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmationCode: 'DELETE', reason: 'Middle bill mistake' });
    assert.strictEqual(delRes.status, 200);

    // Bills #201 and #203 must remain completely intact
    const checkB1 = await Bill.findById(b1.body._id);
    const checkB3 = await Bill.findById(b3.body._id);
    assert.strictEqual(checkB1.billNo, 201);
    assert.strictEqual(checkB3.billNo, 203);

    // The next created bill must be #204 (not #202)
    const b4 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C2',
        items: [{ particulars: 'Prawns', quantity: 20, rate: 100 }],
      });
    assert.strictEqual(b4.status, 201);
    assert.strictEqual(b4.body.billNo, 204, 'Middle bill deletion does not rollback sequence counter');
  });

  it('Case 3: Safety Guard blocks deleting highest bill if already shared or printed', async () => {
    // Setup bill #301
    await resetSequence('billNo', 300);

    const b1 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C3',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });
    assert.strictEqual(b1.body.billNo, 301);

    // Mark as shared (via public link opening or mark-shared)
    const shareRes = await request(app)
      .post(`/api/bills/${b1.body._id}/mark-shared`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(shareRes.status, 200);
    assert.ok(shareRes.body.sharedAt);

    // Try deleting shared highest bill -> should be blocked!
    const delRes = await request(app)
      .delete(`/api/bills/${b1.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmationCode: 'DELETE', reason: 'Tried to delete shared invoice' });

    assert.strictEqual(delRes.status, 400);
    assert.match(delRes.body.message, /already been shared/i);

    // Check that bill is NOT deleted
    const billAfter = await Bill.findById(b1.body._id);
    assert.strictEqual(billAfter.isDeleted, false);
  });

  it('Case 4: Keeps deletion reason, deletedBy, and deletedAt timestamp on soft-deleted document', async () => {
    await resetSequence('billNo', 400);

    const b1 = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Invoice Numbering Test C4',
        items: [{ particulars: 'Prawns', quantity: 10, rate: 100 }],
      });

    const delRes = await request(app)
      .delete(`/api/bills/${b1.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmationCode: 'DELETE', reason: 'Audit trail test verification' });
    assert.strictEqual(delRes.status, 200);

    const softDeleted = await Bill.findById(b1.body._id);
    assert.strictEqual(softDeleted.isDeleted, true);
    assert.strictEqual(softDeleted.deletedReason, 'Audit trail test verification');
    assert.strictEqual(softDeleted.deletedBy.toString(), adminUser._id.toString());
    assert.ok(softDeleted.deletedAt instanceof Date);
    assert.strictEqual(softDeleted.originalBillNo, 401);
  });

  it('Case 5: Safety Guard for legacy/old bills without timestamps (>24h)', async () => {
    await resetSequence('billNo', 500);

    // 1. Create a bill and backdate it to 48 hours ago without sharedAt / printedAt
    const oldBill = await Bill.create({
      billNo: 501,
      companyName: 'Invoice Numbering Test C5',
      companyGstin: '37ABCDE1234F1Z5',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      quantity: 10,
      rate: 100,
      total: 1000,
      grandTotal: 1000,
      items: [{ particulars: 'Prawns', quantity: 10, rate: 100, amount: 1000 }],
      paymentStatus: 'Pending',
      isDeleted: false,
      isVoided: false,
      createdBy: adminUser._id,
    });
    await Counter.findOneAndUpdate({ id: 'billNo' }, { seq: 501 });

    // Trying to delete legacy highest bill (>24h old) must be blocked
    const delOldRes = await request(app)
      .delete(`/api/bills/${oldBill._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmationCode: 'DELETE', reason: 'Try deleting 48h old invoice' });

    assert.strictEqual(delOldRes.status, 400);
    assert.match(delOldRes.body.message, /issued more than 24 hours ago/i);

    // Verify bill is intact in DB
    const checkOld = await Bill.findById(oldBill._id);
    assert.strictEqual(checkOld.isDeleted, false);
  });
});

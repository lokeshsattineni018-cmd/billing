const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
process.env.JWT_SECRET = 'test_jwt_secret_key_production_readiness_32b';

const app = require('../../src/app');
const User = require('../../src/models/User');
const Bill = require('../../src/models/Bill');
const { resetSequence } = require('../../src/models/Counter');

function extractTextFromPdf(pdfBuffer) {
  const pdfStr = pdfBuffer.toString('latin1');
  let text = '';

  function parseContent(content) {
    const tjRegex = /\[(.*?)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(content)) !== null) {
      const hexParts = tjMatch[1].match(/<([0-9a-fA-F]+)>/g) || [];
      const combinedHex = hexParts.map(h => h.slice(1, -1)).join('');
      text += Buffer.from(combinedHex, 'hex').toString('utf8') + ' ';
    }
    const singleTjRegex = /\((.*?)\)\s*Tj/g;
    let sMatch;
    while ((sMatch = singleTjRegex.exec(content)) !== null) {
      text += sMatch[1] + ' ';
    }
  }

  parseContent(pdfStr);
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(pdfStr)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString();
      parseContent(decompressed);
    } catch (e) {
      // not compressed or different stream format
    }
  }
  return text;
}

describe('Operator-Entered Particulars & Default Values Integration Tests', () => {
  let adminToken;
  let adminUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await mongoose.connection.collection('bills').deleteMany({ companyName: /Particulars Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /particulars-admin/ });

    adminUser = await User.create({
      name: 'Particulars Admin',
      username: 'part_admin',
      email: 'particulars-admin@srsf.local',
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
    await mongoose.connection.collection('bills').deleteMany({ companyName: /Particulars Test/ });
    await mongoose.connection.collection('users').deleteMany({ email: /particulars-admin/ });
    await mongoose.disconnect();
  });

  it('keeps operator-entered custom particulars on saved bill and renders on the PDF', async () => {
    await resetSequence('billNo', 800);

    const customParticulars = 'BLACK TIGER';
    const createRes = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Particulars Test Custom',
        companyGstin: '37ABCDE1234F1Z5',
        items: [
          {
            particulars: customParticulars,
            count: '30/40',
            quantity: 20,
            rate: 650,
          },
        ],
      });

    assert.strictEqual(createRes.status, 201);
    const billId = createRes.body._id;

    // Verify saved document in MongoDB
    const savedBill = await Bill.findById(billId);
    assert.ok(savedBill);
    assert.strictEqual(savedBill.items[0].particulars, customParticulars);
    assert.strictEqual(savedBill.particulars, customParticulars);

    // Verify PDF generation contains the custom operator-entered particulars
    const pdfRes = await request(app)
      .get(`/api/bills/${billId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob');

    assert.strictEqual(pdfRes.status, 200);
    assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf');

    const pdfText = extractTextFromPdf(pdfRes.body);
    assert.ok(
      pdfText.includes(customParticulars),
      `Generated PDF must render operator-entered particulars "${customParticulars}". Found text: ${pdfText.substring(0, 300)}...`
    );
  });

  it('defaults particulars to HEAD-ON when operator enters no particulars or empty string', async () => {
    await resetSequence('billNo', 850);

    const createRes = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Particulars Test Default',
        companyGstin: '37ABCDE1234F1Z5',
        items: [
          {
            particulars: '', // empty particulars
            count: '40/50',
            quantity: 15,
            rate: 450,
          },
        ],
      });

    assert.strictEqual(createRes.status, 201);
    const billId = createRes.body._id;

    // Verify saved document defaults to HEAD-ON
    const savedBill = await Bill.findById(billId);
    assert.ok(savedBill);
    assert.strictEqual(savedBill.items[0].particulars, 'HEAD-ON');

    // Verify PDF generation contains standard HEAD-ON / HEAD-LESS
    const pdfRes = await request(app)
      .get(`/api/bills/${billId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob');

    assert.strictEqual(pdfRes.status, 200);
    const pdfText = extractTextFromPdf(pdfRes.body);
    assert.ok(
      pdfText.includes('HEAD-ON'),
      'Generated PDF must render default HEAD-ON when particulars was empty'
    );
  });
});

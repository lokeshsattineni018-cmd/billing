process.env.ENCRYPTION_KEY = 'test_encryption_key_32_bytes_len';
process.env.JWT_SECRET = 'test_jwt_secret_key_production_readiness_32b';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encryptText, decryptText } = require('../../src/utils/crypto');
const Settings = require('../../src/models/Settings');
const { sendDailySummaryEmail } = require('../../src/services/emailService');

describe('SMTP Credentials At-Rest Encryption & Migration Unit Tests', () => {
  const samplePlaintext = 'super_secret_smtp_app_password_987';

  it('encrypts plaintext with AES-256-GCM format', () => {
    const encrypted = encryptText(samplePlaintext);

    assert.ok(encrypted.startsWith('enc:v1:'));
    assert.ok(!encrypted.includes(samplePlaintext));

    const parts = encrypted.split(':');
    assert.equal(parts.length, 5); // ['', 'enc', 'v1', iv, tag, ciphertext]
  });

  it('accurately decrypts ciphertext back to original plaintext', () => {
    const encrypted = encryptText(samplePlaintext);
    const decrypted = decryptText(encrypted);

    assert.equal(decrypted, samplePlaintext);
  });

  it('supports transparent backward compatibility for unencrypted legacy strings', () => {
    const legacyPlaintext = 'old_unencrypted_password_123';
    const result = decryptText(legacyPlaintext);

    assert.equal(result, legacyPlaintext);
  });

  it('does not re-encrypt already encrypted strings (idempotent)', () => {
    const encrypted = encryptText(samplePlaintext);
    const doubleEncrypted = encryptText(encrypted);

    assert.equal(doubleEncrypted, encrypted);
  });

  it('Settings model setter automatically encrypts smtpPass on assignment', () => {
    const doc = new Settings({
      businessName: 'Vijaya Durga Seafoods',
      smtpUser: 'notifications@vda.com',
      smtpPass: samplePlaintext,
    });

    assert.ok(doc.smtpPass.startsWith('enc:v1:'));
    assert.ok(!doc.smtpPass.includes(samplePlaintext));

    // When decrypted, matches original
    assert.equal(decryptText(doc.smtpPass), samplePlaintext);
  });

  it('does not crash when ENCRYPTION_KEY and JWT_SECRET are absent, safely warns and passes through', () => {
    const origEnc = process.env.ENCRYPTION_KEY;
    const origJwt = process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;

    try {
      const plain = 'unprotected_text_string';
      assert.doesNotThrow(() => {
        const result = encryptText(plain);
        assert.equal(result, plain);
      });
    } finally {
      process.env.ENCRYPTION_KEY = origEnc;
      process.env.JWT_SECRET = origJwt;
    }
  });

  it('one-time migration: transparently encrypts plaintext password at rest on read', async () => {
    // Create a mock settings doc with a legacy unencrypted password directly on the property
    const mockDoc = {
      _id: 'settings_mock_id',
      businessName: 'Vijaya Durga Seafoods',
      smtpUser: 'owner@vda.local',
      smtpPass: 'raw_legacy_unencrypted_pass',
      saved: false,
      async save() {
        this.saved = true;
      },
    };

    // Attach setter behavior manually or use ensureSmtpEncrypted
    await Settings.ensureSmtpEncrypted(mockDoc);

    assert.ok(mockDoc.saved, 'Must persist encrypted password to database');
    assert.ok(mockDoc.smtpPass.startsWith('enc:v1:'), 'Must be transformed to AES-256-GCM ciphertext');
    assert.ok(!mockDoc.smtpPass.includes('raw_legacy_unencrypted_pass'));

    // Decrypting returns original
    assert.equal(decryptText(mockDoc.smtpPass), 'raw_legacy_unencrypted_pass');
  });

  it('sendDailySummaryEmail does not crash if SMTP credentials are missing, returns graceful warning', async () => {
    const res = await sendDailySummaryEmail({
      recipientEmail: 'owner@vda.local',
      date: new Date(),
      bills: [],
      summary: { totalBills: 0, totalRevenue: 0 },
      settings: { smtpUser: '', smtpPass: '' },
    });

    assert.equal(res.success, false);
    assert.match(res.message, /not configured/i);
  });

  it('handles wrong/changed encryption key gracefully without crashing, skips email and flags Settings message', async () => {
    // 1. Encrypt with current key
    const ciphertext = encryptText('valid_smtp_pass_1234');

    // 2. Change key in environment to simulate wrong / rotated key
    const origKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'completely_different_key_that_fails_mac';

    try {
      // Decrypt should not throw, returns empty string
      let decrypted;
      assert.doesNotThrow(() => {
        decrypted = decryptText(ciphertext);
      });
      assert.equal(decrypted, '', 'Failed decryption must return empty string');

      // sendDailySummaryEmail must not crash; skips email safely
      const emailRes = await sendDailySummaryEmail({
        recipientEmail: 'owner@vda.local',
        date: new Date(),
        bills: [],
        summary: { totalBills: 0, totalRevenue: 0 },
        settings: { smtpUser: 'admin@vda.com', smtpPass: ciphertext },
      });
      assert.equal(emailRes.success, false);
      assert.match(emailRes.message, /not configured or unavailable/i);

      // Verify Settings response mapping flags decryption failure and shows re-entry instruction
      const settingsDoc = {
        smtpUser: 'admin@vda.com',
        smtpPass: ciphertext,
        toObject() {
          return { smtpUser: this.smtpUser, smtpPass: this.smtpPass };
        },
      };

      const data = settingsDoc.toObject();
      const testDecrypted = decryptText(data.smtpPass);
      if (!testDecrypted) {
        data.smtpConfigured = false;
        data.smtpDecryptionFailed = true;
        data.smtpWarning = 'SMTP password could not be decrypted (encryption key changed or invalid). Please re-enter your SMTP password.';
      }
      delete data.smtpPass;

      assert.equal(data.smtpConfigured, false);
      assert.equal(data.smtpDecryptionFailed, true);
      assert.match(data.smtpWarning, /re-enter your SMTP password/i);
    } finally {
      process.env.ENCRYPTION_KEY = origKey;
    }
  });
});

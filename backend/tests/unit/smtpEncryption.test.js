const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encryptText, decryptText } = require('../../src/utils/crypto');
const Settings = require('../../src/models/Settings');
const { sendDailySummaryEmail } = require('../../src/services/emailService');

describe('SMTP Credentials At-Rest Encryption Unit Tests', () => {
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
});

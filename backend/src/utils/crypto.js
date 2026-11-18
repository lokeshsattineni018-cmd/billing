const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

let hasWarnedMissingKey = false;

/**
 * Derives a consistent 32-byte key from environment variables.
 * Prioritizes ENCRYPTION_KEY, then JWT_SECRET.
 * If neither is set, emits a safe warning and returns null without crashing.
 */
function getMasterKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    if (!hasWarnedMissingKey) {
      console.warn('[SECURITY WARNING] Neither ENCRYPTION_KEY nor JWT_SECRET is configured in environment variables. At-rest encryption falling back to safe unencrypted passthrough.');
      hasWarnedMissingKey = true;
    }
    return null;
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt plaintext string using AES-256-GCM.
 * Output format: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
function encryptText(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return '';
  if (plaintext.startsWith('enc:v1:')) return plaintext; // Prevent double encryption

  const key = getMasterKey();
  if (!key) {
    // If no key is configured, safely return plaintext rather than crashing
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypt ciphertext string using AES-256-GCM.
 * Supports transparent fallback for legacy unencrypted strings.
 */
function decryptText(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  if (!ciphertext.startsWith('enc:v1:')) {
    return ciphertext; // Plaintext fallback
  }

  const key = getMasterKey();
  if (!key) {
    // Cannot decrypt without encryption key; return empty string safely without crashing
    return '';
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) return '';

    const [, , ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret with configured key (authentication MAC failed or key mismatch).');
    return '';
  }
}

module.exports = {
  getMasterKey,
  encryptText,
  decryptText,
};

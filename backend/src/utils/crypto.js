const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

/**
 * Derives a consistent 32-byte key from environment variables.
 */
function getMasterKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'srsf_default_crypto_secret_32bytes_min';
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

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) return '';

    const [, , ivHex, tagHex, encryptedHex] = parts;
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret:', err.message);
    return '';
  }
}

module.exports = {
  encryptText,
  decryptText,
};

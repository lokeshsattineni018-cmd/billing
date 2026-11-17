const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_production_readiness_32b';
const { signToken } = require('../../src/routes/auth');
const { getJwtSecret } = require('../../src/middleware/security');

describe('JWT Expiration & TokenVersion Security Unit Tests', () => {
  it('signs JWT with a 24h expiration window (86400 seconds), not 3650 days', () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const token = signToken(fakeId, 2);

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);

    assert.strictEqual(decoded.id, fakeId);
    assert.strictEqual(decoded.tokenVersion, 2);

    // exp - iat should be 24h in seconds (86,400s)
    const lifespanSeconds = decoded.exp - decoded.iat;
    assert.strictEqual(lifespanSeconds, 86400, 'JWT lifespan must be 24 hours (86400 seconds)');
  });

  it('preserves tokenVersion in the signed JWT payload for server-side revocation', () => {
    const token1 = signToken('user123', 0);
    const decoded1 = jwt.decode(token1);
    assert.strictEqual(decoded1.tokenVersion, 0);

    const token2 = signToken('user123', 5);
    const decoded2 = jwt.decode(token2);
    assert.strictEqual(decoded2.tokenVersion, 5);
  });
});

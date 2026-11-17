const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkSafetyGuards } = require('../../scripts/reset_to_bill_one');

describe('Reset Bills Script Safety Guard Unit Tests', () => {
  it('blocks execution when NODE_ENV is production, even with CONFIRM_PURGE=true', () => {
    assert.throws(
      () => checkSafetyGuards({ NODE_ENV: 'production', CONFIRM_PURGE: 'true' }),
      /cannot be executed in production environment/
    );
  });

  it('blocks execution when CONFIRM_PURGE is missing or not true', () => {
    assert.throws(
      () => checkSafetyGuards({ NODE_ENV: 'development' }),
      /requires explicit CONFIRM_PURGE=true/
    );

    assert.throws(
      () => checkSafetyGuards({ NODE_ENV: 'development', CONFIRM_PURGE: 'false' }),
      /requires explicit CONFIRM_PURGE=true/
    );

    assert.throws(
      () => checkSafetyGuards({ NODE_ENV: 'test', CONFIRM_PURGE: '1' }),
      /requires explicit CONFIRM_PURGE=true/
    );
  });

  it('allows execution only in non-production when CONFIRM_PURGE=true', () => {
    assert.doesNotThrow(() => {
      checkSafetyGuards({ NODE_ENV: 'development', CONFIRM_PURGE: 'true' });
    });

    assert.doesNotThrow(() => {
      checkSafetyGuards({ NODE_ENV: 'test', CONFIRM_PURGE: 'true' });
    });
  });
});

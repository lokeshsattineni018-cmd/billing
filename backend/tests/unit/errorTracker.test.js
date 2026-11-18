const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const errorTracker = require('../../src/utils/errorTracker');

describe('ErrorTracker & Sentry Guarded Require Unit Tests', () => {
  const originalDsn = process.env.SENTRY_DSN;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
    process.env.NODE_ENV = originalEnv;
  });

  it('runs safely in fallback mode when SENTRY_DSN is absent', () => {
    delete process.env.SENTRY_DSN;
    assert.doesNotThrow(() => {
      errorTracker.initErrorTracking();
    });
  });

  it('gracefully handles guarded require when SENTRY_DSN is set but module is uninstalled', () => {
    process.env.SENTRY_DSN = 'https://mockkey@o0.ingest.sentry.io/0';
    assert.doesNotThrow(() => {
      errorTracker.initErrorTracking();
    });
  });

  it('captureException logs error without throwing even when unhandled exception occurs', () => {
    assert.doesNotThrow(() => {
      errorTracker.captureException(new Error('Test unhandled exception'), { testKey: 'val' });
    });
  });

  it('handleServerError strictly masks internal technical errors in production', () => {
    process.env.NODE_ENV = 'production';
    let statusCode = null;
    let jsonPayload = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonPayload = data;
        return this;
      }
    };

    const secretDbError = new Error('MongoServerSelectionError: connection timed out to 10.0.0.1:27017');
    errorTracker.handleServerError(mockRes, secretDbError);

    assert.equal(statusCode, 500);
    assert.equal(jsonPayload.message, 'Internal server error. Please try again later.');
    assert.equal(jsonPayload.stack, undefined, 'Stack trace must NEVER be exposed in production');
  });

  it('handleServerError includes error details in development for debugging', () => {
    process.env.NODE_ENV = 'development';
    let statusCode = null;
    let jsonPayload = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonPayload = data;
        return this;
      }
    };

    const devError = new Error('Validation failed');
    errorTracker.handleServerError(mockRes, devError);

    assert.equal(statusCode, 500);
    assert.equal(jsonPayload.message, 'Validation failed');
    assert.ok(jsonPayload.stack, 'Stack should be available in development mode');
  });
});

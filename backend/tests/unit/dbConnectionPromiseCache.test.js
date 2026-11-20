const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, resetDbConnectionCache } = require('../../src/config/db');

describe('Database Connection Promise & Global Cache Unit Tests', () => {
  const originalConnect = mongoose.connect;
  const originalUri = process.env.MONGODB_URI;

  let readyStateOverride = undefined;
  const realReadyStateDesc = Object.getOwnPropertyDescriptor(mongoose.Connection.prototype, 'readyState') ||
    Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

  before(async () => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
  });

  after(async () => {
    // Restore real readyState descriptor and original connect function
    if (realReadyStateDesc) {
      Object.defineProperty(mongoose.connection, 'readyState', realReadyStateDesc);
    } else {
      delete mongoose.connection.readyState;
    }
    mongoose.connect = originalConnect;
    process.env.MONGODB_URI = originalUri;
    resetDbConnectionCache();

    // Clean disconnect and clean up any test DB artifacts
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    resetDbConnectionCache();
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/srsf_test_suite';
    readyStateOverride = undefined;
    Object.defineProperty(mongoose.connection, 'readyState', {
      get: () => (readyStateOverride !== undefined ? readyStateOverride : 0),
      configurable: true
    });
  });

  afterEach(() => {
    mongoose.connect = originalConnect;
    resetDbConnectionCache();
  });

  it('shares a single pending connection promise across concurrent cold requests', async () => {
    let connectCallCount = 0;
    const fakeConnection = {
      connection: { host: '127.0.0.1:27017' }
    };

    readyStateOverride = 0;

    // Mock mongoose.connect with an artificial delay to simulate cold-start network handshake
    mongoose.connect = async () => {
      connectCallCount++;
      readyStateOverride = 2; // connecting
      await new Promise(resolve => setTimeout(resolve, 30));
      readyStateOverride = 1; // connected
      return fakeConnection;
    };

    // Fire 5 concurrent requests during the cold start window
    const [conn1, conn2, conn3, conn4, conn5] = await Promise.all([
      connectDB(),
      connectDB(),
      connectDB(),
      connectDB(),
      connectDB()
    ]);

    // All callers must resolve to the identical connection instance
    assert.equal(conn1, fakeConnection);
    assert.equal(conn2, fakeConnection);
    assert.equal(conn3, fakeConnection);
    assert.equal(conn4, fakeConnection);
    assert.equal(conn5, fakeConnection);

    // Mongoose connect must be executed exactly once
    assert.equal(connectCallCount, 1);
  });

  it('clears cached promise if connect() rejects and allows successful retry', async () => {
    let connectCallCount = 0;
    readyStateOverride = 0;

    mongoose.connect = async () => {
      connectCallCount++;
      if (connectCallCount === 1) {
        throw new Error('Connection timeout on cold start');
      }
      readyStateOverride = 1;
      return { connection: { host: '127.0.0.1:27017' } };
    };

    // First attempt fails
    await assert.rejects(
      async () => {
        await connectDB();
      },
      /Connection timeout on cold start/
    );

    // Cached promise must be cleared on reject
    assert.equal(global._mongoose.promise, null);

    // Second attempt retries fresh and succeeds
    const conn2 = await connectDB();
    assert.equal(conn2.connection.host, '127.0.0.1:27017');
    assert.equal(connectCallCount, 2);
  });

  it('reconnects when readyState is 0 (disconnected) or 3 (disconnecting)', async () => {
    let connectCallCount = 0;
    const fakeConnection = { connection: { host: '127.0.0.1:27017' } };

    // Initially connected
    readyStateOverride = 1;
    global._mongoose = {
      conn: fakeConnection,
      promise: Promise.resolve(fakeConnection)
    };

    mongoose.connect = async () => {
      connectCallCount++;
      readyStateOverride = 1;
      return fakeConnection;
    };

    // First call while readyState === 1 uses warm cache
    const warmConn = await connectDB();
    assert.equal(warmConn, fakeConnection);
    assert.equal(connectCallCount, 0);

    // Connection drops (readyState becomes 0)
    readyStateOverride = 0;

    // Calling connectDB should detect disconnected state, purge stale cache, and reconnect
    const reconnectedConn = await connectDB();
    assert.equal(reconnectedConn, fakeConnection);
    assert.equal(connectCallCount, 1);

    // Now simulate disconnecting state (readyState === 3)
    readyStateOverride = 3;
    const reconnectedAfterClosing = await connectDB();
    assert.equal(reconnectedAfterClosing, fakeConnection);
    assert.equal(connectCallCount, 2);
  });
});

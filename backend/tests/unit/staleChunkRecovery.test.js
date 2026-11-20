const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('Stale Chunk Recovery & Reload Loop Prevention Unit Tests', async () => {
  const logicPath = path.resolve(__dirname, '../../../website/src/utils/chunkLoadRecoveryLogic.js');
  const {
    isChunkLoadError,
    handleChunkReloadAttempt,
    CHUNK_RELOAD_STORAGE_KEY,
    RELOAD_COOLDOWN_MS
  } = await import(`file://${logicPath}`);

  it('correctly identifies Vite and Rollup dynamic chunk import failure errors', () => {
    // Dynamic import network failure in Vite
    const viteDynamicImportError = new TypeError('Failed to fetch dynamically imported module: http://localhost:4173/assets/NewBill-xyz.js');
    assert.equal(isChunkLoadError(viteDynamicImportError), true);

    // Rollup/Webpack chunk error
    const chunkError = new Error('Loading chunk 12 failed. (missing: /assets/BillHistory-123.js)');
    chunkError.name = 'ChunkLoadError';
    assert.equal(isChunkLoadError(chunkError), true);

    // Safari module load error
    const safariModuleError = new Error('Error loading dynamically imported module');
    assert.equal(isChunkLoadError(safariModuleError), true);

    // Script tag failure
    const scriptFailError = new Error('Failed to load module script: http://localhost:4173/assets/Staff.js');
    assert.equal(isChunkLoadError(scriptFailError), true);

    // Generic network disconnection
    const networkErr = new Error('NetworkError when attempting to fetch resource.');
    assert.equal(isChunkLoadError(networkErr), true);
  });

  it('ignores standard business logic and syntax errors', () => {
    assert.equal(isChunkLoadError(null), false);
    assert.equal(isChunkLoadError(undefined), false);
    assert.equal(isChunkLoadError(new TypeError('Cannot read properties of null (reading "map")')), false);
    assert.equal(isChunkLoadError(new ReferenceError('foo is not defined')), false);
  });

  it('triggers auto-reload once on initial chunk load failure', () => {
    const store = new Map();
    const mockStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key)
    };

    let reloadCalls = 0;
    const mockLocation = {
      reload: () => { reloadCalls++; }
    };

    const initialTime = 1000000;
    const result = handleChunkReloadAttempt(mockStorage, mockLocation, initialTime);

    assert.equal(result, true, 'First failure should trigger reload');
    assert.equal(reloadCalls, 1, 'location.reload() should be called once');
    assert.equal(mockStorage.getItem(CHUNK_RELOAD_STORAGE_KEY), String(initialTime));
  });

  it('strictly prevents infinite reload loop if chunk fails again within cooldown window', () => {
    const store = new Map();
    const mockStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key)
    };

    let reloadCalls = 0;
    const mockLocation = {
      reload: () => { reloadCalls++; }
    };

    const t0 = 2000000;
    // First failure triggers reload
    const firstResult = handleChunkReloadAttempt(mockStorage, mockLocation, t0);
    assert.equal(firstResult, true);
    assert.equal(reloadCalls, 1);

    // Second failure occurs 2 seconds later (e.g. user is completely offline or deploy changed all chunks)
    const t1 = t0 + 2000;
    const secondResult = handleChunkReloadAttempt(mockStorage, mockLocation, t1);

    assert.equal(secondResult, false, 'Second failure within cooldown must NOT trigger reload');
    assert.equal(reloadCalls, 1, 'location.reload() must not be called again');
    // Timestamp remains the original one
    assert.equal(mockStorage.getItem(CHUNK_RELOAD_STORAGE_KEY), String(t0));
  });

  it('permits a new reload attempt after the cooldown period has elapsed', () => {
    const store = new Map();
    const mockStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key)
    };

    let reloadCalls = 0;
    const mockLocation = {
      reload: () => { reloadCalls++; }
    };

    const t0 = 3000000;
    handleChunkReloadAttempt(mockStorage, mockLocation, t0);
    assert.equal(reloadCalls, 1);

    // Later, after cooldown (e.g. 20 seconds later)
    const t2 = t0 + RELOAD_COOLDOWN_MS + 5000;
    const thirdResult = handleChunkReloadAttempt(mockStorage, mockLocation, t2);

    assert.equal(thirdResult, true, 'Reload should be permitted after cooldown expires');
    assert.equal(reloadCalls, 2);
    assert.equal(mockStorage.getItem(CHUNK_RELOAD_STORAGE_KEY), String(t2));
  });
});

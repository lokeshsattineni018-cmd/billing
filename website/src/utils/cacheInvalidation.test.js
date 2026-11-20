import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setMasterCache,
  getMasterCache,
  invalidateBillCaches,
  setDbInstance,
  getUserCacheKey,
} from './offlineDb';

function createMockIndexedDB() {
  const storeMap = new Map();

  return {
    transaction: () => ({
      objectStore: () => ({
        put: (record) => {
          storeMap.set(record.key, record);
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        get: (key) => {
          const result = storeMap.get(key) || null;
          const req = { onsuccess: null, onerror: null, result };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        delete: (key) => {
          storeMap.delete(key);
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        openCursor: () => {
          const entries = Array.from(storeMap.entries());
          let index = 0;
          const req = { onsuccess: null, onerror: null };
          function advance() {
            if (index < entries.length) {
              const [curKey, curVal] = entries[index++];
              const cursor = {
                key: curKey,
                value: curVal,
                delete: () => storeMap.delete(curKey),
                continue: () => advance(),
              };
              req.onsuccess && req.onsuccess({ target: { result: cursor } });
            } else {
              req.onsuccess && req.onsuccess({ target: { result: null } });
            }
          }
          setTimeout(advance, 0);
          return req;
        },
      }),
    }),
    _rawMap: storeMap,
  };
}

describe('Cache Invalidation & Real-time Refresh Events', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockIndexedDB();
    setDbInstance(mockDb);
  });

  it('purges history and dashboard caches across all users after a bill mutation', async () => {
    const userA = { _id: 'u1', role: 'admin' };
    const userB = { _id: 'u2', role: 'owner' };

    // Set history and dashboard caches
    await setMasterCache(getUserCacheKey('historyPage1', userA), { bills: [1, 2] });
    await setMasterCache(getUserCacheKey('historyPage1', userB), { bills: [3, 4] });
    await setMasterCache(getUserCacheKey('dashboardSummary', userA), { total: 100 });
    await setMasterCache(getUserCacheKey('dashboardAnalytics', userA), { chart: [] });
    await setMasterCache(getUserCacheKey('dashboardCombined', userA), { combined: true });

    // Set an unrelated cache key (e.g. settings) that must NOT be purged
    await setMasterCache(getUserCacheKey('settings', userA), { gstin: '37AAAAA0000A1Z5' });

    expect(mockDb._rawMap.size).toBe(6);

    // Trigger invalidation (e.g. after create, edit, payment, void, delete)
    await invalidateBillCaches('create');

    // Settings remains intact
    const settings = await getMasterCache(getUserCacheKey('settings', userA));
    expect(settings).toEqual({ gstin: '37AAAAA0000A1Z5' });

    // History and dashboard caches must be purged
    expect(await getMasterCache(getUserCacheKey('historyPage1', userA))).toBeNull();
    expect(await getMasterCache(getUserCacheKey('historyPage1', userB))).toBeNull();
    expect(await getMasterCache(getUserCacheKey('dashboardSummary', userA))).toBeNull();
    expect(await getMasterCache(getUserCacheKey('dashboardAnalytics', userA))).toBeNull();
    expect(await getMasterCache(getUserCacheKey('dashboardCombined', userA))).toBeNull();
  });

  it('dispatches vda-cache-invalidated event with mutation reason', async () => {
    let capturedEvent = null;
    const listeners = [];
    const originalWindow = globalThis.window;
    const originalCustomEvent = globalThis.CustomEvent;

    globalThis.window = {
      addEventListener: (type, cb) => listeners.push({ type, cb }),
      removeEventListener: (type, cb) => {
        const idx = listeners.findIndex((l) => l.type === type && l.cb === cb);
        if (idx !== -1) listeners.splice(idx, 1);
      },
      dispatchEvent: (evt) => {
        listeners.filter((l) => l.type === evt.type).forEach((l) => l.cb(evt));
        return true;
      },
    };
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };

    const listener = (event) => {
      capturedEvent = event;
    };

    window.addEventListener('vda-cache-invalidated', listener);

    try {
      await invalidateBillCaches('payment');
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent.detail?.reason).toBe('payment');

      await invalidateBillCaches('void');
      expect(capturedEvent.detail?.reason).toBe('void');

      await invalidateBillCaches('delete');
      expect(capturedEvent.detail?.reason).toBe('delete');
    } finally {
      window.removeEventListener('vda-cache-invalidated', listener);
      globalThis.window = originalWindow;
      globalThis.CustomEvent = originalCustomEvent;
    }
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserCacheKey,
  getMasterCache,
  setMasterCache,
  clearMasterCache,
  setDbInstance,
  STORES,
} from './offlineDb';

// In-memory mock IndexedDB store to test isolation & safety
function createMockIndexedDB() {
  const storeMap = new Map();

  return {
    transaction: (storeName, mode) => {
      return {
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
          clear: () => {
            storeMap.clear();
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
      };
    },
    _rawMap: storeMap,
  };
}

describe('Cache Safety & User Isolation', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockIndexedDB();
    setDbInstance(mockDb);
  });

  it('generates role- and user-specific cache keys', () => {
    const adminUser = { _id: 'admin_123', role: 'admin' };
    const staffUser = { _id: 'staff_456', role: 'staff' };
    const ownerUser = { id: 'owner_789', role: 'owner' };

    const adminKey = getUserCacheKey('dashboardSummary', adminUser);
    const staffKey = getUserCacheKey('dashboardSummary', staffUser);
    const ownerKey = getUserCacheKey('dashboardSummary', ownerUser);

    expect(adminKey).toBe('dashboardSummary_admin_123_admin');
    expect(staffKey).toBe('dashboardSummary_staff_456_staff');
    expect(ownerKey).toBe('dashboardSummary_owner_789_owner');
    expect(adminKey).not.toBe(staffKey);
    expect(adminKey).not.toBe(ownerKey);
  });

  it('falls back safely for anonymous or role-missing users', () => {
    const anonKey = getUserCacheKey('settings', null);
    expect(anonKey).toBe('settings_anon_guest');

    const emptyUserKey = getUserCacheKey('historyPage1', {});
    expect(emptyUserKey).toBe('historyPage1_anon_guest');
  });

  it('prevents staff login from reading admin/owner cached financial data', async () => {
    const adminUser = { _id: 'admin_1', role: 'admin' };
    const staffUser = { _id: 'staff_2', role: 'staff' };

    const adminSummaryKey = getUserCacheKey('dashboardSummary', adminUser);
    const staffSummaryKey = getUserCacheKey('dashboardSummary', staffUser);

    // Admin logs in and caches high-value business metrics
    const sensitiveAdminData = { totalRevenue: 9500000, netProfit: 1250000, secretMargin: '18%' };
    await setMasterCache(adminSummaryKey, sensitiveAdminData);

    // Verify admin can read their data
    const readByAdmin = await getMasterCache(adminSummaryKey);
    expect(readByAdmin).toEqual(sensitiveAdminData);

    // Verify staff user querying their own key gets null
    const readByStaff = await getMasterCache(staffSummaryKey);
    expect(readByStaff).toBeNull();
  });

  it('clears all master caches on logout', async () => {
    const admin = { _id: 'admin_1', role: 'admin' };
    await setMasterCache(getUserCacheKey('dashboardSummary', admin), { revenue: 1000 });
    await setMasterCache(getUserCacheKey('historyPage1', admin), [{ billNo: 101 }]);
    await setMasterCache(getUserCacheKey('settings', admin), { gstin: '37ABCDE1234F1Z5' });

    expect(mockDb._rawMap.size).toBe(3);

    // Logout triggered
    await clearMasterCache();

    // Verify masterCache store is completely wiped
    expect(mockDb._rawMap.size).toBe(0);
    const cached = await getMasterCache(getUserCacheKey('dashboardSummary', admin));
    expect(cached).toBeNull();
  });
});

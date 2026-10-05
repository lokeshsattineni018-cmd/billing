/**
 * True Offline-First IndexedDB Storage Engine for Seafood Shed Operations
 * Database: vda_shed_offline_v2
 * 
 * Provides resilient, zero-network persistence for:
 * 1. pendingSync: Outbox queue of bills, labor entries, ice & wastage logs waiting to sync to MongoDB Atlas.
 * 2. offlineBills: Locally generated invoices with receipt formats and print layouts.
 * 3. offlineStaff: Locally recorded peeling labor & worker entries.
 * 4. masterCache: Offline cache for settings, customer directory, worker names, and item prices.
 */

const DB_NAME = 'vda_shed_offline_v2';
const DB_VERSION = 2;

export const STORES = {
  PENDING_SYNC: 'pendingSync',
  OFFLINE_BILLS: 'offlineBills',
  OFFLINE_STAFF: 'offlineStaff',
  MASTER_CACHE: 'masterCache',
};

let dbInstance = null;

export function openOfflineDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Pending sync outbox queue
      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id' });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        syncStore.createIndex('status', 'status', { unique: false });
      }

      // 2. Offline bills storage
      if (!db.objectStoreNames.contains(STORES.OFFLINE_BILLS)) {
        const billStore = db.createObjectStore(STORES.OFFLINE_BILLS, { keyPath: '_id' });
        billStore.createIndex('createdAt', 'createdAt', { unique: false });
        billStore.createIndex('billNo', 'billNo', { unique: false });
        billStore.createIndex('companyName', 'companyName', { unique: false });
        billStore.createIndex('synced', 'synced', { unique: false });
      }

      // 3. Offline staff labor work storage
      if (!db.objectStoreNames.contains(STORES.OFFLINE_STAFF)) {
        const staffStore = db.createObjectStore(STORES.OFFLINE_STAFF, { keyPath: '_id' });
        staffStore.createIndex('date', 'date', { unique: false });
        staffStore.createIndex('staffName', 'staffName', { unique: false });
        staffStore.createIndex('synced', 'synced', { unique: false });
      }

      // 4. Master data cache (settings, customers, items, worker names)
      if (!db.objectStoreNames.contains(STORES.MASTER_CACHE)) {
        db.createObjectStore(STORES.MASTER_CACHE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      // Attempt legacy migration in background
      migrateLegacyPendingBills().catch(() => {});
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Migration helper: copy any leftover items from legacy 'vda_billing_offline'
 */
async function migrateLegacyPendingBills() {
  try {
    const legacyReq = indexedDB.open('vda_billing_offline', 1);
    legacyReq.onsuccess = async () => {
      const legDb = legacyReq.result;
      if (!legDb.objectStoreNames.contains('pending_bills')) {
        legDb.close();
        return;
      }
      const tx = legDb.transaction('pending_bills', 'readonly');
      const store = tx.objectStore('pending_bills');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = async () => {
        const legacyBills = getAllReq.result || [];
        legDb.close();
        if (legacyBills.length > 0) {
          for (const item of legacyBills) {
            const { offlineId, _offlineCreatedAt, ...billData } = item;
            const tempId = `offline_bill_legacy_${offlineId || Date.now()}`;
            await saveOfflineBill({
              ...billData,
              _id: tempId,
              billNo: `OFFLINE-LEGACY-${offlineId || '1'}`,
              isOffline: true,
              synced: false,
              createdAt: _offlineCreatedAt || new Date().toISOString(),
            });
            await queuePendingAction({
              type: 'CREATE_BILL',
              endpoint: '/bills',
              payload: billData,
              clientRefId: tempId,
              label: `Legacy Invoice (${billData.companyName || 'Customer'})`,
            });
          }
          // Delete old database once migrated
          indexedDB.deleteDatabase('vda_billing_offline');
        }
      };
    };
  } catch (e) {
    // Ignore migration errors
  }
}

/* =========================================================================
   PENDING SYNC QUEUE OPERATIONS
   ========================================================================= */

/**
 * Queue an action for background synchronization with MongoDB Atlas
 */
export async function queuePendingAction({
  type, // 'CREATE_BILL' | 'CREATE_STAFF' | 'CREATE_STAFF_BULK' | 'CREATE_ICE' | 'CREATE_WASTAGE' | 'PAY_STAFF'
  endpoint,
  method = 'POST',
  payload,
  clientRefId = null,
  label = '',
}) {
  const db = await openOfflineDB();
  const id = `sync_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const record = {
    id,
    type,
    endpoint,
    method,
    payload,
    clientRefId,
    label: label || `${type} action`,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending', // 'pending' | 'syncing' | 'failed'
    lastError: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_SYNC);
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all queued pending sync actions in FIFO order
 */
export async function getPendingSyncQueue() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readonly');
    const store = tx.objectStore(STORES.PENDING_SYNC);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      // Sort oldest first (FIFO)
      records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove an item from the pending sync queue after successful upload
 */
export async function removePendingAction(id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_SYNC);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update sync status for a queue item
 */
export async function updatePendingAction(id, updates) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_SYNC);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve(null);
      const updated = { ...item, ...updates };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/* =========================================================================
   OFFLINE BILLS OPERATIONS
   ========================================================================= */

/**
 * Save or update a bill in offline storage
 */
export async function saveOfflineBill(bill) {
  const db = await openOfflineDB();
  const billRecord = {
    ...bill,
    _id: bill._id || `offline_bill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    billNo: bill.billNo || `SHED-OFFLINE-${Date.now().toString().slice(-4)}`,
    formattedBillNo: bill.formattedBillNo || bill.billNo || `SHED-OFFLINE-${Date.now().toString().slice(-4)}`,
    isOffline: bill.isOffline !== undefined ? bill.isOffline : true,
    synced: !!bill.synced,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_BILLS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_BILLS);
    const req = store.put(billRecord);
    req.onsuccess = () => resolve(billRecord);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a specific bill by ID from offline storage
 */
export async function getOfflineBill(id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_BILLS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_BILLS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all offline bills (most recent first)
 */
export async function getAllOfflineBills() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_BILLS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_BILLS);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update offline bill once synced to MongoDB Atlas
 */
export async function markBillAsSynced(tempId, serverBill) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_BILLS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_BILLS);
    
    // Delete temp record if server gave a new Mongo _id
    if (tempId && tempId !== serverBill._id) {
      store.delete(tempId);
    }

    const syncedRecord = {
      ...serverBill,
      isOffline: false,
      synced: true,
      syncedAt: new Date().toISOString(),
    };

    const putReq = store.put(syncedRecord);
    putReq.onsuccess = () => resolve(syncedRecord);
    putReq.onerror = () => reject(putReq.error);
  });
}

/* =========================================================================
   OFFLINE STAFF LABOR OPERATIONS
   ========================================================================= */

/**
 * Save a staff labor entry offline
 */
export async function saveOfflineStaff(entry) {
  const db = await openOfflineDB();
  const staffRecord = {
    ...entry,
    _id: entry._id || `offline_staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    isOffline: true,
    synced: false,
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_STAFF, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_STAFF);
    const req = store.put(staffRecord);
    req.onsuccess = () => resolve(staffRecord);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all locally recorded staff entries
 */
export async function getAllOfflineStaff() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_STAFF, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_STAFF);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark staff entry as synced
 */
export async function markStaffAsSynced(tempId, serverEntry) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_STAFF, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_STAFF);
    if (tempId && tempId !== serverEntry._id) {
      store.delete(tempId);
    }
    const syncedRecord = {
      ...serverEntry,
      isOffline: false,
      synced: true,
    };
    const req = store.put(syncedRecord);
    req.onsuccess = () => resolve(syncedRecord);
    req.onerror = () => reject(req.error);
  });
}

/* =========================================================================
   MASTER DATA CACHING (Settings, Customers, Items, Worker Names)
   ========================================================================= */

/**
 * Save master data in IndexedDB for instant zero-network access
 */
export async function setMasterCache(key, data) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MASTER_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.MASTER_CACHE);
      const req = store.put({ key, data, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Retrieve master data from IndexedDB
 */
export async function getMasterCache(key) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MASTER_CACHE, 'readonly');
      const store = tx.objectStore(STORES.MASTER_CACHE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

/* =========================================================================
   STATS & SUMMARY
   ========================================================================= */

/**
 * Get pending sync count breakdown
 */
export async function getPendingCounts() {
  const queue = await getPendingSyncQueue();
  const counts = {
    total: queue.length,
    bills: 0,
    staff: 0,
    ice: 0,
    wastage: 0,
    other: 0,
  };

  for (const item of queue) {
    if (item.type === 'CREATE_BILL') counts.bills++;
    else if (item.type === 'CREATE_STAFF' || item.type === 'CREATE_STAFF_BULK' || item.type === 'PAY_STAFF') counts.staff++;
    else if (item.type === 'CREATE_ICE') counts.ice++;
    else if (item.type === 'CREATE_WASTAGE') counts.wastage++;
    else counts.other++;
  }

  return counts;
}

/**
 * Clear synced records older than 30 days to keep IndexedDB lean
 */
export async function pruneOldSyncedRecords() {
  try {
    const db = await openOfflineDB();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Prune offlineBills that are already synced
    const tx = db.transaction([STORES.OFFLINE_BILLS, STORES.OFFLINE_STAFF], 'readwrite');
    const billStore = tx.objectStore(STORES.OFFLINE_BILLS);
    const getAllBills = billStore.getAll();

    getAllBills.onsuccess = () => {
      const bills = getAllBills.result || [];
      bills.forEach((b) => {
        if (b.synced && b.syncedAt && b.syncedAt < thirtyDaysAgo) {
          billStore.delete(b._id);
        }
      });
    };
  } catch (e) {
    // Ignore cleanup errors
  }
}

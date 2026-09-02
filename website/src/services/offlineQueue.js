/**
 * Offline Bill Queue — IndexedDB wrapper for storing bills when offline
 * and auto-syncing when connectivity returns.
 */

const DB_NAME = 'vda_billing_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_bills';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'offlineId', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a bill to the offline queue
 */
export async function savePendingBill(billData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      ...billData,
      _offlineCreatedAt: new Date().toISOString(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all pending offline bills
 */
export async function getPendingBills() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a successfully synced bill from offline queue
 */
export async function removePendingBill(offlineId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(offlineId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get count of pending offline bills
 */
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Sync all pending bills to the server
 * Returns { synced: number, failed: number }
 */
export async function syncPendingBills(billsAPI) {
  const pending = await getPendingBills();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const bill of pending) {
    try {
      const { offlineId, _offlineCreatedAt, ...billData } = bill;
      await billsAPI.create(billData);
      await removePendingBill(offlineId);
      synced++;
    } catch (err) {
      console.error('Failed to sync offline bill:', err);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Register online listener for auto-sync
 */
export function registerAutoSync(billsAPI, onSyncComplete) {
  const handler = async () => {
    const count = await getPendingCount();
    if (count > 0) {
      const result = await syncPendingBills(billsAPI);
      if (onSyncComplete) onSyncComplete(result);
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}

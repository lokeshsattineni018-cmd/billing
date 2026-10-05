/**
 * Backward compatibility wrapper for offlineQueue.js
 * Delegates to the unified offlineDb and syncManager engine.
 */

import {
  saveOfflineBill,
  getPendingSyncQueue,
  removePendingAction,
  getPendingCounts,
} from '../utils/offlineDb';
import { flushSyncQueue, enqueueShedAction, subscribeSyncStatus } from './syncManager';

export async function savePendingBill(billData) {
  const tempId = `offline_bill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const offlineBill = {
    ...billData,
    _id: tempId,
    billNo: `SHED-OFFLINE-${Date.now().toString().slice(-4)}`,
    formattedBillNo: `SHED-OFFLINE-${Date.now().toString().slice(-4)}`,
    isOffline: true,
    synced: false,
    createdAt: new Date().toISOString(),
  };

  await saveOfflineBill(offlineBill);
  await enqueueShedAction({
    type: 'CREATE_BILL',
    endpoint: '/bills',
    payload: billData,
    clientRefId: tempId,
    label: `Invoice for ${billData.companyName || 'Customer'}`,
  });

  return offlineBill;
}

export async function getPendingBills() {
  const queue = await getPendingSyncQueue();
  return queue.filter((item) => item.type === 'CREATE_BILL').map((item) => ({
    ...item.payload,
    offlineId: item.id,
    clientRefId: item.clientRefId,
  }));
}

export async function removePendingBill(offlineId) {
  return removePendingAction(offlineId);
}

export async function getPendingCount() {
  const counts = await getPendingCounts();
  return counts.total;
}

export async function syncPendingBills() {
  return flushSyncQueue();
}

export function registerAutoSync(billsAPI, onSyncComplete) {
  return subscribeSyncStatus((state) => {
    if (onSyncComplete && !state.isSyncing) {
      onSyncComplete({ synced: 0, failed: 0, pending: state.pendingCounts.total });
    }
  });
}

/**
 * Background & Foreground Sync Orchestrator for Shed Mode (Zero-Network PWA)
 * Manages outbox queue flushing to MongoDB Atlas when cellular/WiFi connectivity connects.
 */

import {
  queuePendingAction,
  getPendingSyncQueue,
  removePendingAction,
  updatePendingAction,
  markBillAsSynced,
  markStaffAsSynced,
  getPendingCounts,
} from '../utils/offlineDb';
import { billsAPI, staffAPI } from './api';
import { playSuccessSound } from '../utils/helpers';

let isSyncing = false;
const listeners = new Set();
let syncBroadcastChannel = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncBroadcastChannel = new BroadcastChannel('vda_shed_sync_channel');
    syncBroadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_COMPLETE' || event.data?.type === 'QUEUE_UPDATED') {
        notifyListeners();
      }
    };
  } catch (e) {
    // BroadcastChannel unsupported or restricted
  }
}

/**
 * Register state listener for sync status updates
 */
export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  // Send current status immediately
  getSyncState().then((state) => listener(state)).catch(() => {});
  return () => listeners.delete(listener);
}

/**
 * Get current sync state
 */
export async function getSyncState() {
  const counts = await getPendingCounts();
  return {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing,
    pendingCounts: counts,
    hasPending: counts.total > 0,
  };
}

/**
 * Notify all subscribed React components
 */
async function notifyListeners() {
  const state = await getSyncState();
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      // Ignore listener error
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vda-shed-sync-state', { detail: state }));
  }
}

/**
 * Broadcast sync message across tabs
 */
function broadcast(type, payload = {}) {
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.postMessage({ type, payload });
    } catch (e) {}
  }
}

/**
 * Request Service Worker Background Sync registration if supported
 */
export async function requestBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.sync) {
        await registration.sync.register('sync-shed-records');
      }
    } catch (e) {
      // Background Sync API not permitted or unsupported, fallback to online event
    }
  }
}

/**
 * Queue an action for background synchronization with MongoDB Atlas
 */
export async function enqueueShedAction({ type, endpoint, payload, clientRefId = null, label = '' }) {
  const record = await queuePendingAction({
    type,
    endpoint,
    payload,
    clientRefId,
    label,
  });

  await notifyListeners();
  broadcast('QUEUE_UPDATED');
  await requestBackgroundSync();

  // If online right now, attempt immediate sync in background
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      flushSyncQueue().catch(() => {});
    }, 500);
  }

  return record;
}

/**
 * Flush all pending offline records to MongoDB Atlas
 * Returns { synced: number, failed: number, remaining: number }
 */
export async function flushSyncQueue() {
  if (isSyncing) return { synced: 0, failed: 0, inProgress: true };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0, offline: true };
  }

  isSyncing = true;
  await notifyListeners();

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getPendingSyncQueue();
    if (queue.length === 0) {
      isSyncing = false;
      await notifyListeners();
      return { synced: 0, failed: 0, remaining: 0 };
    }

    for (const item of queue) {
      // If network dropped mid-sync, abort cleanly
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }

      await updatePendingAction(item.id, { status: 'syncing' });

      try {
        let serverResponse = null;

        switch (item.type) {
          case 'CREATE_BILL': {
            // Strip client-side temp fields before sending to API
            const { _offlineCreatedAt, offlineId, isOffline, synced: _s, ...billPayload } = item.payload;
            serverResponse = await billsAPI.create(billPayload);
            if (serverResponse?.data) {
              await markBillAsSynced(item.clientRefId, serverResponse.data);
            }
            break;
          }

          case 'CREATE_STAFF': {
            const { isOffline, synced: _s, ...staffPayload } = item.payload;
            serverResponse = await staffAPI.create(staffPayload);
            if (serverResponse?.data) {
              const entry = serverResponse.data.entry || serverResponse.data;
              await markStaffAsSynced(item.clientRefId, entry);
            }
            break;
          }

          case 'CREATE_STAFF_BULK': {
            serverResponse = await staffAPI.createBulk(item.payload);
            break;
          }

          case 'CREATE_ICE': {
            serverResponse = await staffAPI.createIce(item.payload);
            break;
          }

          case 'CREATE_WASTAGE': {
            serverResponse = await staffAPI.createWastage(item.payload);
            break;
          }

          case 'PAY_STAFF': {
            if (item.payload?.entryId) {
              serverResponse = await staffAPI.togglePayment(item.payload.entryId, item.payload.data || {});
            }
            break;
          }

          default:
            if (import.meta.env.DEV) {
              console.warn(`[SyncManager] Unknown sync action type: ${item.type}`);
            }
        }

        // Successfully sent to MongoDB Atlas
        await removePendingAction(item.id);
        synced++;
      } catch (err) {
        const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network');
        if (isNetworkErr) {
          // Reset to pending so it will retry next time
          await updatePendingAction(item.id, { status: 'pending', lastError: 'Network disconnected' });
          // Stop processing remaining items until connectivity is stable
          break;
        } else {
          // Server returned 4xx/5xx validation error
          failed++;
          await updatePendingAction(item.id, {
            status: 'failed',
            retries: (item.retries || 0) + 1,
            lastError: err.response?.data?.message || err.message || 'Sync failed',
          });
        }
      }
    }
  } finally {
    isSyncing = false;
    await notifyListeners();
    broadcast('SYNC_COMPLETE', { synced, failed });

    if (synced > 0) {
      playSuccessSound();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('vda-sync-completed', {
            detail: { synced, failed, timestamp: new Date().toISOString() },
          })
        );
      }
    }
  }

  const remainingCounts = await getPendingCounts();
  return { synced, failed, remaining: remainingCounts.total };
}

/**
 * Initialize automatic sync listeners on app startup
 */
export function initSyncManager() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    notifyListeners();
    // Short debounce for cellular data handshake to settle
    setTimeout(() => {
      flushSyncQueue().catch(() => {});
    }, 1200);
  };

  const handleOffline = () => {
    notifyListeners();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen to Service Worker messages (e.g. background sync waking up)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
        flushSyncQueue().catch(() => {});
      }
    });
  }

  // Periodic heartbeat: check queue every 15s if online and pending items exist
  const intervalId = setInterval(async () => {
    if (navigator.onLine && !isSyncing) {
      const counts = await getPendingCounts();
      if (counts.total > 0) {
        flushSyncQueue().catch(() => {});
      }
    }
  }, 15000);

  // Initial trigger if online and has pending
  setTimeout(() => {
    if (navigator.onLine) {
      flushSyncQueue().catch(() => {});
    }
  }, 2000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
  };
}

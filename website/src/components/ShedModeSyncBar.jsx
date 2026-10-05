import React, { useState, useEffect } from 'react';
import {
  subscribeSyncStatus,
  flushSyncQueue,
  getSyncState,
} from '../services/syncManager';
import { getPendingSyncQueue } from '../utils/offlineDb';
import { CloseIcon, RefreshIcon, CheckIcon } from './Icons';
import { formatDateTime } from '../utils/helpers';

export default function ShedModeSyncBar() {
  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCounts: { total: 0, bills: 0, staff: 0, ice: 0, wastage: 0 },
    hasPending: false,
  });

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [justSyncedCount, setJustSyncedCount] = useState(0);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((state) => {
      setSyncState(state);
    });

    const handleSyncCompleted = (e) => {
      const count = e.detail?.synced || 0;
      if (count > 0) {
        setJustSyncedCount(count);
        setTimeout(() => setJustSyncedCount(0), 4500);
      }
      loadQueueItems();
    };

    window.addEventListener('vda-sync-completed', handleSyncCompleted);

    return () => {
      unsubscribe();
      window.removeEventListener('vda-sync-completed', handleSyncCompleted);
    };
  }, []);

  const loadQueueItems = async () => {
    try {
      const items = await getPendingSyncQueue();
      setQueueItems(items);
    } catch (e) {
      setQueueItems([]);
    }
  };

  const handleOpenQueue = async () => {
    await loadQueueItems();
    setShowQueueModal(true);
  };

  const handleTriggerSync = async () => {
    setSyncError('');
    const result = await flushSyncQueue();
    if (result.failed > 0 && result.synced === 0) {
      setSyncError('Sync failed. Please check internet connection.');
    }
    await loadQueueItems();
  };

  const { isOnline, isSyncing, pendingCounts } = syncState;

  // Nothing to display if online with 0 pending and no recent sync
  if (isOnline && !isSyncing && pendingCounts.total === 0 && justSyncedCount === 0) {
    return null;
  }

  return (
    <>
      {/* Top Fixed Alert Bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 16px',
          fontSize: '0.82rem',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          background: !isOnline
            ? 'linear-gradient(90deg, #b45309 0%, #d97706 100%)'
            : isSyncing
            ? 'linear-gradient(90deg, #0b5394 0%, #2563eb 100%)'
            : justSyncedCount > 0
            ? 'linear-gradient(90deg, #15803d 0%, #16a34a 100%)'
            : 'linear-gradient(90deg, #0369a1 0%, #0284c7 100%)',
          color: '#ffffff',
          letterSpacing: '0.01em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {!isOnline ? (
            <>
              <span style={{ fontSize: '1rem', animation: 'pulse 1.5s infinite' }}>⚡</span>
              <span>
                <strong>SHED MODE (OFFLINE)</strong> &bull; Factory floor uninterrupted &bull; {pendingCounts.total} records queued
              </span>
            </>
          ) : isSyncing ? (
            <>
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <span>Auto-syncing {pendingCounts.total} shed records to MongoDB Atlas cloud...</span>
            </>
          ) : justSyncedCount > 0 ? (
            <>
              <span>✅</span>
              <span>Atlas Cloud Sync Complete! {justSyncedCount} records saved to database.</span>
            </>
          ) : (
            <>
              <span>☁️</span>
              <span>{pendingCounts.total} records queued for MongoDB Atlas cloud sync</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {pendingCounts.total > 0 && (
            <button
              onClick={handleOpenQueue}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.78rem',
              }}
            >
              Queue ({pendingCounts.total})
            </button>
          )}

          {isOnline && !isSyncing && pendingCounts.total > 0 && (
            <button
              onClick={handleTriggerSync}
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#0b5394',
                padding: '3px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.78rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              Sync Now
            </button>
          )}
        </div>
      </div>

      {/* Interactive Shed Queue Modal */}
      {showQueueModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowQueueModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                  }}
                >
                  ⚡
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Shed Mode Outbox Queue
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                    IndexedDB Local Storage &bull; {pendingCounts.total} pending transactions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowQueueModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Network Status Badge */}
            <div
              style={{
                padding: '12px 24px',
                background: !isOnline ? '#fffbeb' : '#f0fdf4',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: !isOnline ? '#f59e0b' : '#22c55e',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: !isOnline ? '#92400e' : '#15803d' }}>
                  {!isOnline ? 'Cellular / WiFi Network: Disconnected' : 'Cellular / WiFi Network: Connected to Cloud'}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {isOnline ? 'Atlas Sync: Ready' : 'Saving to Local Device'}
              </span>
            </div>

            {/* Queue Item List */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, maxHeight: '380px' }}>
              {queueItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>☁️</div>
                  <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.95rem' }}>All Shed Records Synced</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Zero pending items. All bills, peeling labor, and ice logs are in MongoDB Atlas.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {queueItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            background:
                              item.type === 'CREATE_BILL'
                                ? '#dbeafe'
                                : item.type.includes('STAFF')
                                ? '#fef3c7'
                                : '#e0e7ff',
                            color:
                              item.type === 'CREATE_BILL'
                                ? '#1d4ed8'
                                : item.type.includes('STAFF')
                                ? '#b45309'
                                : '#4338ca',
                            flexShrink: 0,
                          }}
                        >
                          {item.type === 'CREATE_BILL'
                            ? 'INVOICE'
                            : item.type === 'CREATE_STAFF_BULK'
                            ? 'BULK LABOR'
                            : item.type === 'CREATE_STAFF'
                            ? 'LABOR'
                            : item.type === 'CREATE_ICE'
                            ? 'ICE'
                            : 'RECORD'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.label || item.type}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            {formatDateTime(item.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: item.status === 'syncing' ? '#e0f2fe' : item.status === 'failed' ? '#fee2e2' : '#fef9c3',
                            color: item.status === 'syncing' ? '#0369a1' : item.status === 'failed' ? '#b91c1c' : '#854d0e',
                          }}
                        >
                          {item.status === 'syncing' ? 'Syncing...' : item.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {syncError && (
              <div style={{ padding: '8px 24px', background: '#fee2e2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
                ⚠️ {syncError}
              </div>
            )}

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                🔒 Data is safely stored in browser IndexedDB
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowQueueModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Close
                </button>

                {pendingCounts.total > 0 && isOnline && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    style={{
                      padding: '8px 18px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <RefreshIcon size={14} spinning={isSyncing} />
                    {isSyncing ? 'Syncing...' : 'Sync All Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

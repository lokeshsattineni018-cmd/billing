import React, { useState, useEffect } from 'react';
import { recycleBinAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast, Toast, formatDate } from '../utils/helpers';
import { TrashIcon, InvoiceIcon } from '../components/Icons';

export default function RecycleBin() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState('bills'); // 'bills' | 'ice' | 'wastage' | 'staff'
  const [data, setData] = useState({ bills: [], ice: [], wastage: [], staff: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  const loadDeletedRecords = async () => {
    setLoading(true);
    try {
      const res = await recycleBinAPI.list({ type: 'all' });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load recycle bin:', err);
      showToast(err.response?.data?.message || 'Failed to load recycle bin records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedRecords();
  }, []);

  const handleRestore = async (type, id, displayName) => {
    setRestoringId(id);
    try {
      let res;
      if (type === 'bills') {
        res = await recycleBinAPI.restoreBill(id);
      } else if (type === 'ice') {
        res = await recycleBinAPI.restoreIce(id);
      } else if (type === 'wastage') {
        res = await recycleBinAPI.restoreWastage(id);
      } else if (type === 'staff') {
        res = await recycleBinAPI.restoreStaff(id);
      }
      showToast(res?.data?.message || `${displayName} restored successfully!`, 'success');
      loadDeletedRecords();
    } catch (err) {
      console.error('Restore error:', err);
      showToast(err.response?.data?.message || `Failed to restore ${displayName}`, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const counts = data.counts || { bills: 0, ice: 0, wastage: 0, staff: 0, total: 0 };

  return (
    <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => {}} />}

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
            }}
          >
            🗑️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {lang === 'te' ? 'రీసైకిల్ బిన్ & రికవరీ' : 'Recycle Bin & Data Recovery'}
              </h1>
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                Admin Only
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#94a3b8' }}>
              {lang === 'te'
                ? 'తొలగించబడిన ఇన్‌వాయిస్‌లు, ఐస్ ఖర్చులు, వేస్టేజ్ సేల్స్ మరియు కార్మికుల రికార్డులను ఎప్పుడైనా తిరిగి పొందండి.'
                : 'Restore deleted invoices, ice expenses, wastage sales, and worker attendance back to live accounts.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadDeletedRecords}
          disabled={loading}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            fontWeight: 700,
            borderRadius: '10px',
            padding: '9px 18px',
          }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Bin'}
        </button>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'bills' ? '#0b5394' : 'transparent',
            color: activeTab === 'bills' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🧾 Invoices</span>
          <span
            style={{
              background: activeTab === 'bills' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              color: activeTab === 'bills' ? '#ffffff' : '#475569',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {counts.bills || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ice')}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'ice' ? '#0b5394' : 'transparent',
            color: activeTab === 'ice' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🧊 Ice Usage</span>
          <span
            style={{
              background: activeTab === 'ice' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              color: activeTab === 'ice' ? '#ffffff' : '#475569',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {counts.ice || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wastage')}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'wastage' ? '#0b5394' : 'transparent',
            color: activeTab === 'wastage' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🦐 Prawn Head Wastage</span>
          <span
            style={{
              background: activeTab === 'wastage' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              color: activeTab === 'wastage' ? '#ffffff' : '#475569',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {counts.wastage || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'staff' ? '#0b5394' : 'transparent',
            color: activeTab === 'staff' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>👥 Worker Attendance</span>
          <span
            style={{
              background: activeTab === 'staff' ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              color: activeTab === 'staff' ? '#ffffff' : '#475569',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {counts.staff || 0}
          </span>
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div className="btn-spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px auto' }}></div>
          <p style={{ color: '#64748b', fontWeight: 600 }}>Loading deleted records...</p>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* TAB 1: INVOICES */}
          {activeTab === 'bills' && (
            <div>
              {data.bills.length === 0 ? (
                <EmptyState label="No deleted invoices in recycle bin." />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Customer Name</th>
                        <th>Date</th>
                        <th className="text-right">Grand Total</th>
                        <th>Deleted On</th>
                        <th>Deleted By</th>
                        <th>Reason</th>
                        <th className="text-center" style={{ width: '130px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bills.map((bill) => {
                        const billNo = bill.originalBillNo || Math.abs(bill.billNo);
                        const isRestoring = restoringId === bill._id;
                        return (
                          <tr key={bill._id}>
                            <td style={{ fontWeight: 800, fontFamily: 'monospace', color: '#dc2626' }}>
                              #{billNo}
                            </td>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>
                              {bill.companyName}
                            </td>
                            <td>{formatDate(bill.date)}</td>
                            <td className="text-right" style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              ₹{Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {bill.deletedAt ? new Date(bill.deletedAt).toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ fontSize: '0.84rem', color: '#475569' }}>
                              {bill.deletedBy?.name || 'Admin'}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                              {bill.deletedReason || '—'}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isRestoring}
                                onClick={() => handleRestore('bills', bill._id, `Invoice #${billNo}`)}
                                style={{
                                  background: '#16a34a',
                                  borderColor: '#15803d',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isRestoring ? 'Restoring...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ICE USAGE */}
          {activeTab === 'ice' && (
            <div>
              {data.ice.length === 0 ? (
                <EmptyState label="No deleted ice records in recycle bin." />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Supplier / From</th>
                        <th>Blocks</th>
                        <th>Rate (₹)</th>
                        <th className="text-right">Total Amount</th>
                        <th>Deleted On</th>
                        <th>Reason</th>
                        <th className="text-center" style={{ width: '130px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ice.map((item) => {
                        const isRestoring = restoringId === item._id;
                        return (
                          <tr key={item._id}>
                            <td>{formatDate(item.date)}</td>
                            <td style={{ fontWeight: 700 }}>
                              {item.iceFrom || item.supplierName || '—'}
                            </td>
                            <td style={{ fontWeight: 800 }}>{item.blocks} blocks</td>
                            <td>₹{item.rate}</td>
                            <td className="text-right" style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {item.deletedAt ? new Date(item.deletedAt).toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                              {item.deletedReason || '—'}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isRestoring}
                                onClick={() => handleRestore('ice', item._id, `Ice record (${item.blocks} blocks)`)}
                                style={{
                                  background: '#16a34a',
                                  borderColor: '#15803d',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isRestoring ? 'Restoring...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WASTAGE SALES */}
          {activeTab === 'wastage' && (
            <div>
              {data.wastage.length === 0 ? (
                <EmptyState label="No deleted wastage sales in recycle bin." />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Buyer Name</th>
                        <th>Quantity (KG)</th>
                        <th>Rate / KG</th>
                        <th className="text-right">Total Amount</th>
                        <th>Deleted On</th>
                        <th>Reason</th>
                        <th className="text-center" style={{ width: '130px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.wastage.map((item) => {
                        const isRestoring = restoringId === item._id;
                        return (
                          <tr key={item._id}>
                            <td>{formatDate(item.date)}</td>
                            <td style={{ fontWeight: 700 }}>{item.buyerName || '—'}</td>
                            <td style={{ fontWeight: 800 }}>{item.quantityKg} KG</td>
                            <td>₹{item.rate}</td>
                            <td className="text-right" style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {item.deletedAt ? new Date(item.deletedAt).toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                              {item.deletedReason || '—'}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isRestoring}
                                onClick={() => handleRestore('wastage', item._id, `Wastage sales (${item.quantityKg} KG)`)}
                                style={{
                                  background: '#16a34a',
                                  borderColor: '#15803d',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isRestoring ? 'Restoring...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WORKER ATTENDANCE */}
          {activeTab === 'staff' && (
            <div>
              {data.staff.length === 0 ? (
                <EmptyState label="No deleted worker attendance entries in recycle bin." />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Worker Name</th>
                        <th>Work Type</th>
                        <th>Weight (KG)</th>
                        <th>Rate / KG</th>
                        <th className="text-right">Wages</th>
                        <th>Deleted On</th>
                        <th className="text-center" style={{ width: '130px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((entry) => {
                        const isRestoring = restoringId === entry._id;
                        return (
                          <tr key={entry._id}>
                            <td>{formatDate(entry.date)}</td>
                            <td style={{ fontWeight: 800, color: '#0f172a' }}>{entry.staffName}</td>
                            <td style={{ fontSize: '0.84rem' }}>{entry.workType || 'Peeling'}</td>
                            <td style={{ fontWeight: 800 }}>{entry.quantity} KG</td>
                            <td>₹{entry.price}</td>
                            <td className="text-right" style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              ₹{Number(entry.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {entry.deletedAt ? new Date(entry.deletedAt).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isRestoring}
                                onClick={() => handleRestore('staff', entry._id, `Worker entry for ${entry.staffName}`)}
                                style={{
                                  background: '#16a34a',
                                  borderColor: '#15803d',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isRestoring ? 'Restoring...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✨</div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{label}</p>
      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Deleted items will stay safely here until restored.</span>
    </div>
  );
}


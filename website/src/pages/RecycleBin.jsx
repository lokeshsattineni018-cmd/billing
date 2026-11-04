import React, { useState, useEffect } from 'react';
import { recycleBinAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast, Toast, formatDate } from '../utils/helpers';
import { TrashIcon } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ label }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
      <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{label}</p>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 140px',
        padding: '9px 14px',
        borderRadius: '8px',
        border: 'none',
        background: active ? '#0b5394' : 'transparent',
        color: active ? '#ffffff' : '#64748b',
        fontWeight: 700,
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span
        style={{
          background: active ? 'rgba(255,255,255,0.22)' : '#e2e8f0',
          color: active ? '#fff' : '#475569',
          padding: '1px 7px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 800,
          minWidth: '20px',
          textAlign: 'center',
        }}
      >
        {count ?? 0}
      </span>
    </button>
  );
}

export default function RecycleBin() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState('bills');
  const [data, setData] = useState({ bills: [], ice: [], wastage: [], staff: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  // Confirm-restore modal state
  const [confirmRestore, setConfirmRestore] = useState(null); // { type, id, label, details }

  const load = async () => {
    setLoading(true);
    try {
      const res = await recycleBinAPI.list({ type: 'all' });
      setData(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load recycle bin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = data.counts || { bills: 0, ice: 0, wastage: 0, staff: 0 };

  // ── Open confirm modal before restoring ──────────────────────────────────
  const askRestore = (type, id, label, details) => {
    setConfirmRestore({ type, id, label, details });
  };

  const doRestore = async () => {
    if (!confirmRestore) return;
    const { type, id, label } = confirmRestore;
    setRestoringId(id);
    setConfirmRestore(null);
    try {
      let res;
      if (type === 'bills')   res = await recycleBinAPI.restoreBill(id);
      else if (type === 'ice')     res = await recycleBinAPI.restoreIce(id);
      else if (type === 'wastage') res = await recycleBinAPI.restoreWastage(id);
      else if (type === 'staff')   res = await recycleBinAPI.restoreStaff(id);
      showToast(res?.data?.message || `${label} restored successfully!`, 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to restore ${label}`, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* ── Page Header (matches ActivityLog / Reports style) ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            🗑️ {lang === 'te' ? 'రీసైకిల్ బిన్ & రికవరీ' : 'Recycle Bin & Data Recovery'}
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {lang === 'te'
              ? 'తొలగించబడిన ఇన్‌వాయిస్‌లు, ఐస్ ఖర్చులు, వేస్టేజ్ & కార్మికుల రికార్డులను తిరిగి పొందండి'
              : 'Restore deleted invoices, ice expenses, wastage sales, and worker attendance'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '20px',
              padding: '3px 12px',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}
          >
            {lang === 'te' ? 'అడ్మిన్ మాత్రమే' : 'Admin Only'}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={load}
            disabled={loading}
            style={{ fontWeight: 700 }}
          >
            {loading ? '...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '16px',
          background: '#ffffff',
          padding: '5px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
      >
        <TabBtn active={activeTab === 'bills'}   onClick={() => setActiveTab('bills')}   label="🧾 Invoices"            count={counts.bills} />
        <TabBtn active={activeTab === 'ice'}     onClick={() => setActiveTab('ice')}     label="🧊 Ice Usage"           count={counts.ice} />
        <TabBtn active={activeTab === 'wastage'} onClick={() => setActiveTab('wastage')} label="🦐 Prawn Head Wastage"  count={counts.wastage} />
        <TabBtn active={activeTab === 'staff'}   onClick={() => setActiveTab('staff')}   label="👷 Worker Attendance"   count={counts.staff} />
      </div>

      {/* ── Content Card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="spinner" style={{ minHeight: '260px' }} />
        ) : (
          <>
            {/* ── TAB: INVOICES ── */}
            {activeTab === 'bills' && (
              data.bills.length === 0 ? (
                <EmptyState label={lang === 'te' ? 'తొలగించబడిన ఇన్‌వాయిస్‌లు లేవు' : 'No deleted invoices in recycle bin.'} />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'te' ? 'బిల్లు నం' : 'Invoice No'}</th>
                        <th>{lang === 'te' ? 'కస్టమర్ పేరు' : 'Customer'}</th>
                        <th>{lang === 'te' ? 'తేదీ' : 'Date'}</th>
                        <th className="text-right">{lang === 'te' ? 'మొత్తం' : 'Amount'}</th>
                        <th>{lang === 'te' ? 'తొలగించిన తేదీ' : 'Deleted On'}</th>
                        <th>{lang === 'te' ? 'తొలగించినవారు' : 'Deleted By'}</th>
                        <th>{lang === 'te' ? 'కారణం' : 'Reason'}</th>
                        <th className="text-center" style={{ width: '110px' }}>
                          {lang === 'te' ? 'చర్య' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bills.map((bill) => {
                        const billNo = bill.originalBillNo || Math.abs(bill.billNo);
                        const busy = restoringId === bill._id;
                        return (
                          <tr key={bill._id}>
                            <td>
                              <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#dc2626' }}>
                                #{billNo}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{bill.companyName || '—'}</td>
                            <td>{formatDate(bill.date)}</td>
                            <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                              ₹{Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {bill.deletedAt
                                ? new Date(bill.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{bill.deletedBy?.name || 'Admin'}</td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                              {bill.deletedReason || '—'}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  askRestore('bills', bill._id, `Invoice #${billNo}`, [
                                    { label: 'Customer', value: bill.companyName || '—' },
                                    { label: 'Amount', value: `₹${Number(bill.grandTotal || 0).toLocaleString('en-IN')}`, isMono: true },
                                    { label: 'Original Bill No', value: `#${billNo}`, isMono: true },
                                  ])
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── TAB: ICE USAGE ── */}
            {activeTab === 'ice' && (
              data.ice.length === 0 ? (
                <EmptyState label={lang === 'te' ? 'తొలగించబడిన ఐస్ రికార్డులు లేవు' : 'No deleted ice records in recycle bin.'} />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'te' ? 'తేదీ' : 'Date'}</th>
                        <th>{lang === 'te' ? 'బ్లాకులు' : 'Blocks'}</th>
                        <th>{lang === 'te' ? 'రేటు' : 'Rate'}</th>
                        <th className="text-right">{lang === 'te' ? 'మొత్తం' : 'Amount'}</th>
                        <th>{lang === 'te' ? 'ఎవరి నుండి' : 'From'}</th>
                        <th>{lang === 'te' ? 'తొలగించిన తేదీ' : 'Deleted On'}</th>
                        <th>{lang === 'te' ? 'తొలగించినవారు' : 'Deleted By'}</th>
                        <th className="text-center" style={{ width: '110px' }}>
                          {lang === 'te' ? 'చర్య' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ice.map((rec) => {
                        const busy = restoringId === rec._id;
                        return (
                          <tr key={rec._id}>
                            <td>{formatDate(rec.date)}</td>
                            <td style={{ fontWeight: 700 }}>{rec.blocks}</td>
                            <td>₹{rec.rate}</td>
                            <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                              ₹{Number(rec.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{rec.iceFrom || '—'}</td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {rec.deletedAt
                                ? new Date(rec.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{rec.deletedBy?.name || 'Admin'}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  askRestore('ice', rec._id, `Ice record (${rec.blocks} blocks)`, [
                                    { label: 'Date', value: formatDate(rec.date) },
                                    { label: 'Blocks', value: rec.blocks },
                                    { label: 'Amount', value: `₹${Number(rec.totalAmount || 0).toLocaleString('en-IN')}`, isMono: true },
                                  ])
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── TAB: PRAWN HEAD WASTAGE ── */}
            {activeTab === 'wastage' && (
              data.wastage.length === 0 ? (
                <EmptyState label={lang === 'te' ? 'తొలగించబడిన వేస్టేజ్ రికార్డులు లేవు' : 'No deleted wastage records in recycle bin.'} />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'te' ? 'తేదీ' : 'Date'}</th>
                        <th>{lang === 'te' ? 'పరిమాణం (కేజీ)' : 'Qty (kg)'}</th>
                        <th>{lang === 'te' ? 'రేటు' : 'Rate'}</th>
                        <th className="text-right">{lang === 'te' ? 'మొత్తం' : 'Amount'}</th>
                        <th>{lang === 'te' ? 'కొనుగోలుదారు' : 'Buyer'}</th>
                        <th>{lang === 'te' ? 'తొలగించిన తేదీ' : 'Deleted On'}</th>
                        <th>{lang === 'te' ? 'తొలగించినవారు' : 'Deleted By'}</th>
                        <th className="text-center" style={{ width: '110px' }}>
                          {lang === 'te' ? 'చర్య' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.wastage.map((rec) => {
                        const busy = restoringId === rec._id;
                        return (
                          <tr key={rec._id}>
                            <td>{formatDate(rec.date)}</td>
                            <td style={{ fontWeight: 700 }}>{rec.quantityKg} kg</td>
                            <td>₹{rec.rate}</td>
                            <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                              ₹{Number(rec.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{rec.buyerName || '—'}</td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {rec.deletedAt
                                ? new Date(rec.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{rec.deletedBy?.name || 'Admin'}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  askRestore('wastage', rec._id, `Wastage record (${rec.quantityKg} kg)`, [
                                    { label: 'Date', value: formatDate(rec.date) },
                                    { label: 'Quantity', value: `${rec.quantityKg} kg` },
                                    { label: 'Amount', value: `₹${Number(rec.totalAmount || 0).toLocaleString('en-IN')}`, isMono: true },
                                  ])
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── TAB: WORKER ATTENDANCE ── */}
            {activeTab === 'staff' && (
              data.staff.length === 0 ? (
                <EmptyState label={lang === 'te' ? 'తొలగించబడిన కార్మికుల రికార్డులు లేవు' : 'No deleted worker attendance records.'} />
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'te' ? 'తేదీ' : 'Date'}</th>
                        <th>{lang === 'te' ? 'కార్మికుని పేరు' : 'Worker Name'}</th>
                        <th>{lang === 'te' ? 'పరిమాణం (కేజీ)' : 'Qty (kg)'}</th>
                        <th>{lang === 'te' ? 'రేటు' : 'Rate'}</th>
                        <th className="text-right">{lang === 'te' ? 'మొత్తం' : 'Amount'}</th>
                        <th>{lang === 'te' ? 'తొలగించిన తేదీ' : 'Deleted On'}</th>
                        <th>{lang === 'te' ? 'తొలగించినవారు' : 'Deleted By'}</th>
                        <th className="text-center" style={{ width: '110px' }}>
                          {lang === 'te' ? 'చర్య' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((rec) => {
                        const busy = restoringId === rec._id;
                        return (
                          <tr key={rec._id}>
                            <td>{formatDate(rec.date)}</td>
                            <td style={{ fontWeight: 600 }}>{rec.staffName || '—'}</td>
                            <td>{rec.quantity} kg</td>
                            <td>₹{rec.price}</td>
                            <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                              ₹{Number(rec.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {rec.deletedAt
                                ? new Date(rec.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.84rem' }}>{rec.deletedBy?.name || 'Admin'}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  askRestore('staff', rec._id, `Worker record (${rec.staffName})`, [
                                    { label: 'Worker', value: rec.staffName || '—' },
                                    { label: 'Date', value: formatDate(rec.date) },
                                    { label: 'Amount', value: `₹${Number(rec.totalAmount || 0).toLocaleString('en-IN')}`, isMono: true },
                                  ])
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {busy ? '...' : '♻️ Restore'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* ── Restore Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!confirmRestore}
        title={lang === 'te' ? 'రికార్డు తిరిగి పొందాలా?' : 'Restore Record?'}
        subtitle={confirmRestore?.label || ''}
        message={
          lang === 'te'
            ? 'ఈ రికార్డు తొలగించబడిన స్థితి నుండి తిరిగి యాక్టివ్ అవుతుంది మరియు అన్ని లెక్కల్లో మళ్ళీ కనిపిస్తుంది.'
            : 'This record will be moved back to active status and will appear again in all reports and accounts.'
        }
        itemDetails={confirmRestore?.details || null}
        confirmText={lang === 'te' ? 'అవును, తిరిగి పొందు' : 'Yes, Restore'}
        cancelText={lang === 'te' ? 'రద్దు' : 'Cancel'}
        confirmType="primary"
        warningText={
          lang === 'te'
            ? 'ఇది రికార్డుని పూర్తిగా తిరిగి యాక్టివ్ చేస్తుంది. ఇన్‌వాయిస్‌ల విషయంలో, బిల్లు నంబర్ సీక్వెన్స్ కూడా సర్దుబాటు అవుతుంది.'
            : 'For invoices, the bill sequence counter will be adjusted accordingly. All related totals will be recalculated.'
        }
        customIcon={<span style={{ fontSize: '1.4rem' }}>♻️</span>}
        loading={!!restoringId}
        confirmLoadingText={lang === 'te' ? 'తిరిగి పొందుతోంది...' : 'Restoring...'}
        onConfirm={doRestore}
        onClose={() => setConfirmRestore(null)}
      />
    </div>
  );
}

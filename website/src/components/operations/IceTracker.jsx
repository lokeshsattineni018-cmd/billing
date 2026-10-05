import { useState, useEffect, useRef } from 'react';
import { staffAPI } from '../../services/api';
import { formatCurrency, formatDate, numberToWords, useToast, Toast, playSuccessSound } from '../../utils/helpers';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { enqueueShedAction } from '../../services/syncManager';
import VoucherBillModal from '../VoucherBillModal';
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  IceIcon,
  CheckIcon,
  RefreshIcon,
  PrintIcon,
} from '../Icons';
import ganeshaImg from '../../assets/ganesha.jpg';
import durgaImg from '../../assets/durga.jpg';
import ramDarbarImg from '../../assets/ram_darbar.jpg';

export default function IceTracker() {
  const { t } = useLanguage();
  const { toast, showToast } = useToast();
  const { user } = useAuth();
  const canEditDelete = user?.role === 'admin' || user?.role === 'owner';

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    blocks: '',
    rate: '',
    iceFrom: '',
    iceTo: '',
    supplierName: '',
    vehicleNo: '',
    paymentStatus: 'Paid',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Bill Preview State (In-app modal like normal bill page)
  const [billEntry, setBillEntry] = useState(null);
  const [viewingBill, setViewingBill] = useState(null);
  const billRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [dateFilter, dateFrom, dateTo, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEntries(), loadSummary()]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load ice data:', err);
      }
    }
    setLoading(false);
  };

  const loadEntries = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (statusFilter) params.paymentStatus = statusFilter;

      const res = await staffAPI.getIce(params);
      setEntries(res.data.entries || []);
    } catch (err) {
      showToast('Failed to load ice records', 'error');
    }
  };

  const loadSummary = async () => {
    try {
      const params = {};
      if (dateFilter) params.dateFilter = dateFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await staffAPI.getIceSummary(params);
      setSummary(res.data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load ice summary:', err);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    showToast('Ice records refreshed', 'success');
  };

  const handleDateFilterChange = (val) => {
    setDateFilter(val);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (val === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (val === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (val === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setDateFrom(w.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (val === 'month') {
      const m = new Date();
      m.setDate(1);
      setDateFrom(m.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (val === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      blocks: '',
      rate: '',
      iceFrom: '',
      iceTo: '',
      supplierName: '',
      vehicleNo: '',
      paymentStatus: 'Paid',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : '',
      blocks: entry.blocks || '',
      rate: entry.rate || '',
      iceFrom: entry.iceFrom || '',
      iceTo: entry.iceTo || '',
      supplierName: entry.supplierName || '',
      vehicleNo: entry.vehicleNo || '',
      paymentStatus: entry.paymentStatus || 'Paid',
      notes: entry.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const numBlocks = parseFloat(formData.blocks);
    const numRate = parseFloat(formData.rate);

    if (!numBlocks || numBlocks <= 0) {
      showToast('Please enter a valid number of ice blocks', 'error');
      return;
    }
    if (isNaN(numRate) || numRate < 0) {
      showToast('Please enter a valid rate per block', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: formData.date,
        blocks: numBlocks,
        rate: numRate,
        iceFrom: formData.iceFrom.trim(),
        iceTo: formData.iceTo.trim(),
        supplierName: formData.supplierName.trim(),
        vehicleNo: formData.vehicleNo.trim(),
        paymentStatus: formData.paymentStatus,
        notes: formData.notes.trim(),
      };

      if (editingEntry) {
        await staffAPI.updateIce(editingEntry._id, payload);
        showToast('Ice record updated successfully!', 'success');
      } else {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const tempId = `offline_ice_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const offlineIce = {
            ...payload,
            _id: tempId,
            voucherNo: `ICE-OFFLINE-${Date.now().toString().slice(-4)}`,
            isOffline: true,
            createdAt: new Date().toISOString(),
          };

          await enqueueShedAction({
            type: 'CREATE_ICE',
            endpoint: '/staff/ice',
            payload,
            clientRefId: tempId,
            label: `Ice Usage (${payload.blocks} blocks)`,
          });

          setEntries((prev) => [offlineIce, ...prev]);
          playSuccessSound();
          showToast(`⚡ Shed Mode: Recorded ${payload.blocks} ice blocks offline!`, 'info');
          setModalOpen(false);
          return;
        }

        await staffAPI.createIce(payload);
        showToast('Ice usage record saved successfully!', 'success');
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network');
      if (isNetworkErr && !editingEntry) {
        try {
          const tempId = `offline_ice_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const offlineIce = {
            ...payload,
            _id: tempId,
            voucherNo: `ICE-OFFLINE-${Date.now().toString().slice(-4)}`,
            isOffline: true,
            createdAt: new Date().toISOString(),
          };

          await enqueueShedAction({
            type: 'CREATE_ICE',
            endpoint: '/staff/ice',
            payload,
            clientRefId: tempId,
            label: `Ice Usage (${payload.blocks} blocks)`,
          });

          setEntries((prev) => [offlineIce, ...prev]);
          playSuccessSound();
          showToast(`⚡ Shed Mode: Recorded ${payload.blocks} ice blocks offline!`, 'info');
          setModalOpen(false);
          return;
        } catch (e) {}
      }
      showToast(err.response?.data?.message || 'Failed to save ice record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete ice record for ${entry.blocks} blocks on ${formatDate(entry.date)}?`)) {
      return;
    }
    try {
      await staffAPI.deleteIce(entry._id);
      showToast('Ice record deleted', 'success');
      setEntries((prev) => prev.filter((it) => it._id !== entry._id));
      loadSummary();
    } catch (err) {
      showToast('Failed to delete ice record', 'error');
    }
  };

  // Generate & View Bill for a single ice entry (In-app viewer with WhatsApp & Print)
  const handleGenerateBill = (entry, index = 0) => {
    const vNo = entry.voucherNo || (entries.length > 0 ? `ICE-${entries.length - index}` : 'ICE-1');
    setBillEntry(entry);
    setViewingBill({ entry, voucherNo: vNo });
  };

  const liveBlocks = parseFloat(formData.blocks) || 0;
  const liveRate = parseFloat(formData.rate) || 0;
  const liveTotal = Math.round(liveBlocks * liveRate * 100) / 100;

  // Dynamic period label
  const periodLabel = dateFilter === 'today' || (dateFilter === 'all' && !dateFrom) ? "Today's" : dateFilter === 'yesterday' ? "Yesterday's" : dateFilter === 'week' ? '7-Day' : dateFilter === 'month' ? "This Month's" : 'Filtered';
  const badgeLabel = dateFilter === 'today' || (dateFilter === 'all' && !dateFrom) ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? '7 Days' : dateFilter === 'month' ? 'Month' : 'Custom';

  return (
    <div>
      <Toast toast={toast} />

      {/* KPI Summary Cards */}
      <div className="dashboard-stats-grid" style={{ marginBottom: '20px' }}>
        {/* Period Ice Blocks */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Ice Blocks
            </span>
            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{badgeLabel}</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>
            {summary?.todayBlocks || 0}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>blocks</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            All-time: {(summary?.totalBlocks || 0).toLocaleString('en-IN')} blocks used
          </div>
        </div>

        {/* Period Ice Cost */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #0891b2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Ice Cost
            </span>
            <IceIcon size={16} color="#0891b2" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0891b2', marginTop: '6px' }}>
            {formatCurrency(summary?.todayAmount || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Formula: Blocks × Rate = Total Cost
          </div>
        </div>

        {/* Average Rate / Block */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Rate / Block
            </span>
            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>₹ / Block</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#6366f1', marginTop: '6px' }}>
            ₹{summary?.todayAvgRate?.toFixed(2) || '0.00'}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Average cost per block in period
          </div>
        </div>

        {/* Total Historical Ice Spend */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Ice Expense
            </span>
            <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>Lifetime</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706', marginTop: '6px' }}>
            {formatCurrency(summary?.totalAmount || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            From {summary?.totalEntries || 0} recorded batches
          </div>
        </div>
      </div>

      {/* Control Bar & Action Buttons */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
          {/* Quick Date Pills */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: 'This Month' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDateFilterChange(p.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: dateFilter === p.id ? '#0b5394' : 'transparent',
                  color: dateFilter === p.id ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '180px', flex: 1 }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
              placeholder="Search supplier, from, to..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadEntries()}
            />
          </div>

          {/* Payment Status Filter */}
          <select
            className="form-input"
            style={{ width: 'auto', height: '34px', fontSize: '0.82rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh Ice records"
          >
            <RefreshIcon size={14} />
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
          >
            <PlusIcon size={16} />
            <span>Record Ice Blocks</span>
          </button>
        </div>
      </div>

      {/* Ice Records Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          <p style={{ fontWeight: 600 }}>Loading Ice Records...</p>
        </div>
      ) : entries.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: '#64748b',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
            }}
          >
            <IceIcon size={28} color="#0284c7" />
          </div>
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            No Ice Usage Records Found
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
            Track how many ice blocks your factory used today, rate per block, and total ice expense.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
          >
            + Record Today's Ice Blocks
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Date</th>
                  <th style={{ width: '120px' }}>From</th>
                  <th style={{ width: '120px' }}>To</th>
                  <th className="text-right" style={{ width: '90px' }}>Blocks</th>
                  <th className="text-right" style={{ width: '100px' }}>Rate</th>
                  <th className="text-right" style={{ width: '120px' }}>Total</th>
                  <th style={{ width: '80px' }}>Status</th>
                  <th>Notes</th>
                  <th className="text-center" style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry._id}>
                    <td style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                      {formatDate(entry.date)}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#0b5394', fontWeight: 600 }}>
                      {entry.iceFrom || '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                      {entry.iceTo || '—'}
                    </td>
                    <td className="text-right">
                      <span style={{ fontWeight: 900, color: '#0284c7', fontSize: '0.98rem' }}>
                        {entry.blocks}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '4px' }}>blocks</span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>
                      ₹{entry.rate?.toFixed(2)}
                    </td>
                    <td className="text-right">
                      <strong style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                        {formatCurrency(entry.totalAmount)}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${(entry.paymentStatus || 'Paid') === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                        {entry.paymentStatus || 'Paid'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {entry.notes || '—'}
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleGenerateBill(entry, index)}
                          title="Generate & View Bill"
                          style={{ padding: '4px 6px' }}
                        >
                          <PrintIcon size={14} color="#7c3aed" />
                        </button>
                        {canEditDelete && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleOpenEditModal(entry)}
                              title="Edit"
                              style={{ padding: '4px 6px' }}
                            >
                              <EditIcon size={14} color="#0b5394" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(entry)}
                              title="Delete"
                              style={{ padding: '4px 6px' }}
                            >
                              <TrashIcon size={14} color="#ef4444" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECORD / EDIT ICE USAGE */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '8px', color: '#0284c7' }}>
                  <IceIcon size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {editingEntry ? 'Edit Ice Usage Record' : 'Record Ice Blocks Used'}
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              {/* Ice From / To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    🏭 Ice From <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>(Supplier)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sri Rama Ice Plant"
                    value={formData.iceFrom}
                    onChange={(e) => setFormData({ ...formData, iceFrom: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    📦 Ice To <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>(Receiver)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Factory / Cold Storage"
                    value={formData.iceTo}
                    onChange={(e) => setFormData({ ...formData, iceTo: e.target.value })}
                  />
                </div>
              </div>

              {/* Dynamic Calculation Row: Blocks * Rate = Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Ice Blocks Used <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 50"
                    value={formData.blocks}
                    onChange={(e) => setFormData({ ...formData, blocks: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Rate per Block (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 150"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Live Calculated Total Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                    Total Ice Expense (Blocks × Rate)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#3b82f6', marginTop: '2px' }}>
                    {liveBlocks} blocks × ₹{liveRate.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0b5394' }}>
                  {formatCurrency(liveTotal)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select
                    className="form-input"
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Morning batch, packing..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ fontWeight: 800 }}
                >
                  {saving ? 'Saving...' : editingEntry ? 'Update Record' : 'Save Ice Usage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden printable bill template for ice entries (Matches Normal Bill Layout) */}
      {billEntry && (
        <div ref={billRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div style={{ border: '1.5px solid #0b5394', background: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            {/* 1. TOP BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #0b5394', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 'bold', color: '#0b5394' }}>
              <div>ICE BILL</div>
              <div style={{ textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '1px' }}>॥ జై శ్రీరామ్ ॥</div>
              <div>Cell: 9441429745</div>
            </div>

            {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #0b5394', padding: '8px 16px' }}>
              <div style={{ width: '88px', textAlign: 'left', flexShrink: 0 }}>
                <img src={ganeshaImg} alt="Lord Ganesha" style={{ width: '84px', height: '84px', objectFit: 'contain' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
                <img src={durgaImg} alt="Durga Maa" style={{ width: '54px', height: '54px', objectFit: 'contain', margin: '0 auto 2px auto', display: 'block' }} />
                <h1 style={{ color: '#0b5394', fontSize: '1.6rem', fontWeight: 900, letterSpacing: '0.8px', margin: '0 0 2px 0', fontFamily: 'Arial, sans-serif' }}>
                  VIJAYA DURGA SEA FOODS
                </h1>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#000000', margin: '2px 0' }}>
                  Prop: SATTINENI VENKATA DHANA LAXMI &nbsp;|&nbsp; GSTIN: 37KATPS1500Q1ZR
                </div>
                <div style={{ fontSize: '0.68rem', color: '#000000', lineHeight: '1.25' }}>
                  D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.
                </div>
              </div>
              <div style={{ width: '88px', textAlign: 'right', flexShrink: 0 }}>
                <img src={ramDarbarImg} alt="Ram Darbar" style={{ width: '84px', height: '84px', objectFit: 'contain' }} />
              </div>
            </div>

            {/* 3. VOUCHER NO & DATE ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.85rem' }}>
              <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Voucher No.</span>
                <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                  {billEntry.voucherNo || (viewingBill?.voucherNo || 'ICE-1')}
                </span>
              </div>
              <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(billEntry.date)}</span>
              </div>
            </div>

            {/* 4. FROM & TO ROW (WHO SUPPLIED & WHO RECEIVED) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.85rem' }}>
              <div style={{ padding: '6px 10px', borderRight: '1.5px solid #0b5394' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Ice From (Supplier): </span>
                <strong style={{ color: '#000000' }}>{billEntry.iceFrom || billEntry.supplierName || 'Sri Rama Ice Plant'}</strong>
              </div>
              <div style={{ padding: '6px 10px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Ice To (Receiver): </span>
                <strong style={{ color: '#000000' }}>{billEntry.iceTo || 'Factory / Cold Storage'}</strong>
              </div>
            </div>

            {/* 5. STATUS ROW (Vehicle / Transport Removed) */}
            <div style={{ borderBottom: '1.5px solid #0b5394', fontSize: '0.82rem', padding: '5px 10px' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Payment Status: </span>
              <span style={{ fontWeight: 'bold', color: billEntry.paymentStatus === 'Paid' ? '#16a34a' : '#d97706' }}>
                {billEntry.paymentStatus || 'Paid'}
              </span>
            </div>

            {/* 6. ITEMS TABLE (Description is ICE) */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 4px', width: '45px' }}>S.No.</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 8px', textAlign: 'left' }}>Description of Supply</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '120px' }}>Quantity</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '110px' }}>Rate (₹)</th>
                  <th style={{ borderBottom: '1.5px solid #0b5394', padding: '6px', width: '130px', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: '30px', borderBottom: '1px solid #c8d9e8' }}>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', padding: '6px 8px', fontWeight: 'bold' }}>
                    ICE
                  </td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>
                    {billEntry.blocks} blocks
                  </td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '8px' }}>
                    ₹{Number(billEntry.rate).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                    ₹{Number(billEntry.totalAmount).toFixed(2)}
                  </td>
                </tr>
                {[1, 2].map((i) => (
                  <tr key={i} style={{ height: '22px', borderBottom: '1px solid #c8d9e8' }}>
                    <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                    <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                    <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                    <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e8f1f8', borderTop: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ textAlign: 'right', padding: '8px 12px', color: '#0b5394', fontSize: '0.9rem', fontWeight: 900 }}>
                    TOTAL AMOUNT:
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 10px', fontSize: '1.05rem', fontWeight: 900, color: '#000000' }}>
                    ₹{Number(billEntry.totalAmount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Amount in Words (NO Notes / Remarks row) */}
            <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Amount in Words: </span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{numberToWords(billEntry.totalAmount)}</span>
            </div>

            {/* 7. BANK DETAILS & SIGNATURE (Exact Normal Bill Footer) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', borderTop: '1.5px solid #0b5394', fontSize: '0.74rem', lineHeight: '1.4' }}>
              <div style={{ borderRight: '1.5px solid #0b5394', padding: '6px 10px' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394' }}>BANK : KARUR VYSYA BANK</div>
                <div>A/c. NO : <strong>4805135000002964</strong></div>
                <div>IFSC : <strong>KVBL0004815</strong></div>
                <div>Branch : Narasapur</div>
              </div>

              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.78rem' }}>
                  For VIJAYA DURGA SEA FOODS
                </div>
                <div style={{ marginTop: '24px', borderTop: '1px solid #000000', paddingTop: '2px', fontWeight: 'bold', color: '#0b5394' }}>
                  Proprietor / Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IN-APP VOUCHER BILL VIEWER MODAL (LIKE NORMAL BILL PAGE WITH WHATSAPP & PRINT) ── */}
      {viewingBill && (
        <VoucherBillModal
          isOpen={Boolean(viewingBill)}
          onClose={() => setViewingBill(null)}
          type="ice"
          data={viewingBill.entry}
          voucherNo={viewingBill.voucherNo}
        />
      )}
    </div>
  );
}

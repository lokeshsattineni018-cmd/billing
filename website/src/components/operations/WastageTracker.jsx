import { useState, useEffect, useRef } from 'react';
import { staffAPI } from '../../services/api';
import { formatCurrency, formatDate, useToast, Toast, playSuccessSound } from '../../utils/helpers';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { enqueueShedAction } from '../../services/syncManager';
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  ScaleIcon,
  CheckIcon,
  RefreshIcon,
} from '../Icons';
import ConfirmModal from '../ConfirmModal';

export default function WastageTracker() {
  const { t } = useLanguage();
  const { toast, showToast } = useToast();
  const { user } = useAuth();
  const canEditDelete = user?.role === 'admin' || user?.role === 'owner';

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    category: 'Prawn Head',
    quantityKg: '',
    rate: '',
    buyerName: '',
    vehicleNo: '',
    paymentStatus: 'Paid',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [dateFilter, dateFrom, dateTo, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEntries(), loadSummary()]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load wastage data:', err);
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

      const res = await staffAPI.getWastage(params);
      setEntries(res.data.entries || []);
    } catch (err) {
      showToast('Failed to load wastage records', 'error');
    }
  };

  const loadSummary = async () => {
    try {
      const params = {};
      if (dateFilter) params.dateFilter = dateFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await staffAPI.getWastageSummary(params);
      setSummary(res.data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load wastage summary:', err);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    showToast('Wastage records refreshed', 'success');
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
      category: 'Prawn Head',
      quantityKg: '',
      rate: '',
      buyerName: '',
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
      category: entry.category || 'Prawn Head',
      quantityKg: entry.quantityKg || '',
      rate: entry.rate || '',
      buyerName: entry.buyerName || '',
      vehicleNo: entry.vehicleNo || '',
      paymentStatus: entry.paymentStatus || 'Paid',
      notes: entry.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const numKg = parseFloat(formData.quantityKg);
    const numRate = parseFloat(formData.rate);

    if (!numKg || numKg <= 0) {
      showToast('Please enter a valid quantity in boxes for prawn head wastage', 'error');
      return;
    }
    if (isNaN(numRate) || numRate < 0) {
      showToast('Please enter a valid rate per box', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: formData.date,
        category: formData.category.trim() || 'Prawn Head',
        quantityKg: numKg,
        rate: numRate,
        buyerName: formData.buyerName.trim(),
        vehicleNo: formData.vehicleNo.trim(),
        paymentStatus: formData.paymentStatus,
        notes: formData.notes.trim(),
      };

      if (editingEntry) {
        await staffAPI.updateWastage(editingEntry._id, payload);
        showToast('Wastage sales record updated!', 'success');
      } else {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const tempId = `offline_wastage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const offlineWastage = {
            ...payload,
            _id: tempId,
            voucherNo: `WASTE-OFFLINE-${Date.now().toString().slice(-4)}`,
            isOffline: true,
            createdAt: new Date().toISOString(),
          };

          await enqueueShedAction({
            type: 'CREATE_WASTAGE',
            endpoint: '/staff/wastage',
            payload,
            clientRefId: tempId,
            label: `Wastage: ${payload.quantityKg} boxes (${payload.buyerName || 'Buyer'})`,
          });

          setEntries((prev) => [offlineWastage, ...prev]);
          playSuccessSound();
          showToast(`⚡ Shed Mode: Recorded ${payload.quantityKg} boxes wastage sales offline!`, 'info');
          setModalOpen(false);
          return;
        }

        await staffAPI.createWastage(payload);
        showToast('Prawn head wastage sales record saved!', 'success');
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network');
      if (isNetworkErr && !editingEntry) {
        try {
          const tempId = `offline_wastage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const offlineWastage = {
            ...payload,
            _id: tempId,
            voucherNo: `WASTE-OFFLINE-${Date.now().toString().slice(-4)}`,
            isOffline: true,
            createdAt: new Date().toISOString(),
          };

          await enqueueShedAction({
            type: 'CREATE_WASTAGE',
            endpoint: '/staff/wastage',
            payload,
            clientRefId: tempId,
            label: `Wastage: ${payload.quantityKg} boxes (${payload.buyerName || 'Buyer'})`,
          });

          setEntries((prev) => [offlineWastage, ...prev]);
          playSuccessSound();
          showToast(`⚡ Shed Mode: Recorded ${payload.quantityKg} boxes wastage sales offline!`, 'info');
          setModalOpen(false);
          return;
        } catch (e) {}
      }
      showToast(err.response?.data?.message || 'Failed to save wastage record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePromptDelete = (entry) => {
    setEntryToDelete(entry);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    try {
      await staffAPI.deleteWastage(entryToDelete._id);
      showToast('Wastage record deleted', 'success');
      setEntries((prev) => prev.filter((it) => it._id !== entryToDelete._id));
      setDeleteModalOpen(false);
      setEntryToDelete(null);
      loadSummary();
    } catch (err) {
      showToast('Failed to delete wastage record', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const liveBoxes = parseFloat(formData.quantityKg) || 0;
  const liveRate = parseFloat(formData.rate) || 0;
  const liveTotal = Math.round(liveBoxes * liveRate * 100) / 100;

  return (
    <div>
      <Toast toast={toast} />

      {/* KPI Summary Cards */}
      {(() => {
        const periodLabel = dateFilter === 'today' || (dateFilter === 'all' && !dateFrom) ? "Today's" : dateFilter === 'yesterday' ? "Yesterday's" : dateFilter === 'week' ? '7-Day' : dateFilter === 'month' ? "This Month's" : 'Filtered';
        const badgeLabel = dateFilter === 'today' || (dateFilter === 'all' && !dateFrom) ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? '7 Days' : dateFilter === 'month' ? 'Month' : 'Custom';
        return (
      <div className="staff-kpi-grid" style={{ marginBottom: '20px' }}>
        {/* Period Wastage Sold (Boxes) */}
        <div className="staff-kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Prawn Head Sold
            </span>
            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>{badgeLabel}</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
            {(summary?.todayKg || 0).toLocaleString('en-IN')}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>boxes</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            All-time: {(summary?.totalKg || 0).toLocaleString('en-IN')} boxes sold
          </div>
        </div>

        {/* Period Wastage Revenue */}
        <div className="staff-kpi-card" style={{ borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Revenue
            </span>
            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Income</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
            {formatCurrency(summary?.todayAmount || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Formula: Prawn Head (Boxes) × Rate = Total
          </div>
        </div>

        {/* Average Rate / Box */}
        <div className="staff-kpi-card" style={{ borderLeft: '4px solid #0b5394' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              {periodLabel} Selling Rate
            </span>
            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>₹ / BOX</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
            ₹{summary?.todayAvgRate?.toFixed(2) || '0.00'}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Average selling price per box in period
          </div>
        </div>

        {/* Total Wastage Sales Income */}
        <div className="staff-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Wastage Sales
            </span>
            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>Lifetime</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6', marginTop: '6px' }}>
            {formatCurrency(summary?.totalAmount || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            From {summary?.totalEntries || 0} recorded sales batches
          </div>
        </div>
      </div>
        );
      })()}

      {/* Control Bar & Action Buttons */}
      <div className="card staff-control-bar">
        <div className="staff-control-left">
          {/* Quick Date Pills */}
          <div className="staff-date-pills">
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

          {/* Search & Status Filter Row Side-by-Side */}
          <div className="staff-filter-row">
            <div style={{ position: 'relative', flex: 1.4 }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadEntries()}
              />
            </div>

            <select
              className="form-select"
              style={{ flex: 1 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="staff-control-right">
          <button
            type="button"
            className="btn btn-secondary btn-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh wastage records"
          >
            <RefreshIcon size={15} />
          </button>

          <button
            type="button"
            className="btn btn-primary btn-action"
            onClick={handleOpenAddModal}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            <PlusIcon size={16} />
            <span>Record Wastage Sold</span>
          </button>
        </div>
      </div>

      {/* Wastage Records Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          <p style={{ fontWeight: 600 }}>Loading Wastage Sales Records...</p>
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
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
            }}
          >
            <ScaleIcon size={28} color="#16a34a" />
          </div>
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            No Prawn Head Wastage Sales Records Found
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
            Track total prawn head and shell wastage sold (boxes), selling rate per box, and total revenue earned.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            + Record Prawn Head Wastage Sold
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Cards List */}
          <div className="mobile-bills-list" style={{ marginBottom: '16px' }}>
            {entries.map((entry) => (
              <div key={entry._id} className="mobile-bill-card">
                <div className="mobile-bill-header">
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      {formatDate(entry.date)}
                    </span>
                    <span className="badge badge-purple" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>
                      {entry.category || 'Prawn Head'}
                    </span>
                  </div>
                  <span className={`badge ${(entry.paymentStatus || 'Paid') === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                    {entry.paymentStatus || 'Paid'}
                  </span>
                </div>

                <div className="mobile-bill-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '6px 0' }}>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Boxes Sold</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16a34a' }}>
                      {entry.quantityKg} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>boxes</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>₹{entry.rate?.toFixed(2)} / box</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Revenue</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16a34a' }}>
                      {formatCurrency(entry.totalAmount)}
                    </div>
                    {entry.buyerName && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{entry.buyerName}</div>
                    )}
                  </div>
                </div>

                {entry.notes && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '2px 0' }}>
                    "{entry.notes}"
                  </div>
                )}

                {canEditDelete && (
                  <div className="mobile-bill-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditModal(entry)}
                    >
                      <EditIcon size={14} color="#0b5394" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => handlePromptDelete(entry)}
                    >
                      <TrashIcon size={14} color="#ef4444" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="card desktop-only-table" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Date</th>
                    <th>Category</th>
                    <th className="text-right" style={{ width: '140px' }}>Boxes Sold</th>
                    <th className="text-right" style={{ width: '120px' }}>Rate / Box</th>
                    <th className="text-right" style={{ width: '150px' }}>Total Amount</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th>Notes</th>
                    <th className="text-center" style={{ width: '90px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id}>
                      <td style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                        {formatDate(entry.date)}
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ fontSize: '0.74rem' }}>
                          {entry.category || 'Prawn Head'}
                        </span>
                      </td>
                      <td className="text-right">
                        <span style={{ fontWeight: 900, color: '#16a34a', fontSize: '0.98rem' }}>
                          {entry.quantityKg}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '4px' }}>boxes</span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        ₹{entry.rate?.toFixed(2)}
                      </td>
                      <td className="text-right">
                        <strong style={{ fontSize: '0.96rem', color: '#16a34a' }}>
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
                          {canEditDelete ? (
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
                                onClick={() => handlePromptDelete(entry)}
                                title="Delete"
                                style={{ padding: '4px 6px' }}
                              >
                                <TrashIcon size={14} color="#ef4444" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL: RECORD / EDIT WASTAGE SALES */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '8px', color: '#16a34a' }}>
                  <ScaleIcon size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {editingEntry ? 'Edit Wastage Sales Record' : 'Record Prawn Head Wastage Sold'}
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
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

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Category</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Prawn Head / Shell"
                  />
                </div>
              </div>

              {/* Dynamic Calculation Row: Prawn Head * Rate = Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Prawn Head Sold (Boxes) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 50"
                    value={formData.quantityKg}
                    onChange={(e) => setFormData({ ...formData, quantityKg: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Rate per Box (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 550"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Live Calculated Total Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                    Total Wastage Revenue (Prawn Head × Rate)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#15803d', marginTop: '2px' }}>
                    {liveBoxes} boxes × ₹{liveRate.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d' }}>
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
                    placeholder="Dry shells, morning collection..."
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
                  style={{ fontWeight: 800, background: '#16a34a', borderColor: '#16a34a' }}
                >
                  {saving ? 'Saving...' : editingEntry ? 'Update Record' : 'Save Wastage Sales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Wastage Record?"
        message="Are you sure you want to permanently delete this prawn wastage sales record? This action cannot be undone."
        itemDetails={
          entryToDelete
            ? [
                { label: 'Date', value: formatDate(entryToDelete.date) },
                { label: 'Category', value: entryToDelete.category },
                { label: 'Boxes', value: `${entryToDelete.quantityKg} boxes`, isMono: true },
                { label: 'Rate / Box', value: `₹${entryToDelete.rate}` },
                { label: 'Total Amount', value: formatCurrency(entryToDelete.totalAmount), isMono: true },
                { label: 'Buyer', value: entryToDelete.buyerName || '—' },
                { label: 'Status', value: entryToDelete.paymentStatus },
              ]
            : null
        }
        confirmText="Yes, Delete Record"
        cancelText="Cancel"
        confirmType="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setEntryToDelete(null);
          }
        }}
      />
    </div>
  );
}

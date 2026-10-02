import { useState, useEffect } from 'react';
import { staffAPI } from '../services/api';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';
import {
  StaffIcon,
  PlusIcon,
  SearchIcon,
  ExportIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  ScaleIcon,
  IceIcon,
  RefreshIcon,
} from '../components/Icons';
import IceTracker from '../components/operations/IceTracker';
import WastageTracker from '../components/operations/WastageTracker';
import DailyNetSummary from '../components/operations/DailyNetSummary';

export default function Staff() {
  const { t } = useLanguage();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState('entries'); // 'entries' | 'accounts'
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [staffNames, setStaffNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');

  // Single Work Entry Modal (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    staffName: '',
    staffPhone: '',
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    price: '',
    workType: 'Peeling / Seafood Processing',
    shift: 'Full Day',
    paymentStatus: 'Pending',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Bulk Entry Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkRows, setBulkRows] = useState([
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
  ]);
  const [savingBulk, setSavingBulk] = useState(false);

  // Selected Worker filter from Accounts tab
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState('');

  useEffect(() => {
    loadAllData();
  }, [dateFrom, dateTo, statusFilter, workTypeFilter, selectedWorkerFilter]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEntries(), loadSummary(), loadNames()]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load staff data:', err);
      }
    }
    setLoading(false);
  };

  const loadEntries = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      else if (selectedWorkerFilter) params.search = selectedWorkerFilter;

      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (statusFilter) params.paymentStatus = statusFilter;
      if (workTypeFilter) params.workType = workTypeFilter;

      const res = await staffAPI.getAll(params);
      setEntries(res.data.entries || []);
    } catch (err) {
      showToast('Failed to load work entries', 'error');
    }
  };

  const loadSummary = async () => {
    try {
      const res = await staffAPI.getSummary();
      setSummary(res.data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load summary:', err);
      }
    }
  };

  const loadNames = async () => {
    try {
      const res = await staffAPI.getNames();
      setStaffNames(res.data || []);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load names:', err);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setTimeout(() => {
      setRefreshing(false);
      showToast('Staff records refreshed', 'success');
    }, 400);
  };

  // Quick Date Range Handler
  const handleDatePreset = (preset) => {
    setDateFilter(preset);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const tStr = toYMD(today);
      setDateFrom(tStr);
      setDateTo(tStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      const yStr = toYMD(y);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(today.getDate() - 7);
      setDateFrom(toYMD(d));
      setDateTo(toYMD(today));
    } else if (preset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toYMD(d));
      setDateTo(toYMD(today));
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedWorkerFilter('');
    loadEntries();
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedWorkerFilter('');
    setDateFilter('all');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setWorkTypeFilter('');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingEntry(null);
    setFormData({
      staffName: '',
      staffPhone: '',
      date: new Date().toISOString().split('T')[0],
      quantity: '',
      price: '',
      workType: 'Peeling / Seafood Processing',
      shift: 'Full Day',
      paymentStatus: 'Pending',
      notes: '',
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      staffName: entry.staffName || '',
      staffPhone: entry.staffPhone || '',
      date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : '',
      quantity: entry.quantity || '',
      price: entry.price || '',
      workType: entry.workType || 'Peeling / Seafood Processing',
      shift: entry.shift || 'Full Day',
      paymentStatus: entry.paymentStatus || 'Pending',
      notes: entry.notes || '',
    });
    setModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!formData.staffName.trim()) {
      showToast('Please enter staff name', 'error');
      return;
    }
    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter valid quantity (kg)', 'error');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      showToast('Please enter valid price per kg', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingEntry) {
        await staffAPI.update(editingEntry._id, formData);
        showToast(`Updated entry for ${formData.staffName}`, 'success');
      } else {
        await staffAPI.create(formData);
        showToast(`Added work for ${formData.staffName}: ${qty} kg @ ₹${price}`, 'success');
      }
      setModalOpen(false);
      await loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Payment Status
  const handleTogglePayment = async (entry) => {
    try {
      const newStatus = entry.paymentStatus === 'Paid' ? 'Pending' : 'Paid';
      await staffAPI.togglePayment(entry._id, { status: newStatus });
      showToast(`${entry.staffName} marked as ${newStatus}`, 'success');
      setEntries((prev) =>
        prev.map((item) =>
          item._id === entry._id
            ? {
                ...item,
                paymentStatus: newStatus,
                amountPaid: newStatus === 'Paid' ? item.totalAmount : 0,
              }
            : item
        )
      );
      loadSummary();
    } catch (err) {
      showToast('Failed to update payment status', 'error');
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (entry) => {
    if (!window.confirm(`Delete work entry for ${entry.staffName} (${entry.quantity} kg)?`)) {
      return;
    }
    try {
      await staffAPI.delete(entry._id);
      showToast(`Entry deleted for ${entry.staffName}`, 'success');
      setEntries((prev) => prev.filter((it) => it._id !== entry._id));
      loadSummary();
      loadNames();
    } catch (err) {
      showToast('Failed to delete entry', 'error');
    }
  };

  // Bulk Entry Handlers
  const handleBulkRowChange = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  const handleAddBulkRow = () => {
    setBulkRows((prev) => [
      ...prev,
      { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
    ]);
  };

  const handleRemoveBulkRow = (index) => {
    if (bulkRows.length <= 1) return;
    setBulkRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBulk = async () => {
    const validRows = bulkRows.filter(
      (r) => r.staffName?.trim() && parseFloat(r.quantity) > 0 && parseFloat(r.price) >= 0
    );

    if (validRows.length === 0) {
      showToast('Please fill in at least one worker with name, kg, and price', 'error');
      return;
    }

    setSavingBulk(true);
    try {
      const res = await staffAPI.createBulk({
        date: bulkDate,
        entries: validRows,
      });
      showToast(res.data.message || `Saved ${validRows.length} entries!`, 'success');
      setBulkModalOpen(false);
      setBulkRows([
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
      ]);
      await loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save bulk entries', 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  // Filter by worker clicked from Accounts tab
  const handleViewWorkerHistory = (workerName) => {
    setSelectedWorkerFilter(workerName);
    setSearch(workerName);
    setActiveTab('entries');
  };

  // Live calculation in modal
  const liveQty = parseFloat(formData.quantity) || 0;
  const livePrice = parseFloat(formData.price) || 0;
  const liveTotal = Math.round(liveQty * livePrice * 100) / 100;

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <StaffIcon size={24} color="#0b5394" />
            <span>{t('staff')}</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {t('staffSubtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshIcon size={15} spinning={refreshing} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() =>
              window.open(
                staffAPI.exportCSVUrl({
                  search: search || selectedWorkerFilter,
                  dateFrom,
                  dateTo,
                  paymentStatus: statusFilter,
                }),
                '_blank'
              )
            }
            title="Download CSV report of staff wages for accounting & payout"
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ExportIcon size={15} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setBulkModalOpen(true)}
            style={{ fontWeight: 700, border: '1.5px solid #0b5394', color: '#0b5394' }}
          >
            ⚡ Bulk Attendance
          </button>

          <button
            className="btn btn-primary"
            onClick={handleOpenCreate}
            style={{
              background: 'linear-gradient(135deg, #0b5394, #2563eb)',
              color: '#ffffff',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <PlusIcon size={16} color="#ffffff" />
            <span>+ Add Work Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="dashboard-stats-grid" style={{ marginBottom: '20px' }}>
        {/* Today's Workers */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #0b5394' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Today's Workers
            </span>
            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>Today</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
            {summary?.today?.todayWorkersCount || 0}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>present</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Total {summary?.overall?.totalWorkers || 0} active workers in registry
          </div>
        </div>

        {/* Today's Weight Processed */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #0891b2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Today's Processed
            </span>
            <ScaleIcon size={16} color="#0891b2" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0891b2', marginTop: '6px' }}>
            {(summary?.today?.todayKg || 0).toLocaleString('en-IN')}
            <span style={{ fontSize: '0.9rem', fontWeight: 700, marginLeft: '4px' }}>kg</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Lifetime: {(summary?.overall?.totalKg || 0).toLocaleString('en-IN')} kg
          </div>
        </div>

        {/* Today's Total Wages */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Today's Wages
            </span>
            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Earned</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
            {formatCurrency(summary?.today?.todayWages || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Total Earned: {formatCurrency(summary?.overall?.totalWages || 0)}
          </div>
        </div>

        {/* Total Outstanding Wages to Pay */}
        <div className="stat-card-compact" style={{ borderLeft: '4px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Pending Wages
            </span>
            <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>To Pay</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
            {formatCurrency(summary?.overall?.totalPending || 0)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
            Paid So Far: {formatCurrency(summary?.overall?.totalPaid || 0)}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '16px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('entries')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'entries' ? '3px solid #0b5394' : '3px solid transparent',
            color: activeTab === 'entries' ? '#0b5394' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>👥 Workers Labor</span>
          <span
            style={{
              background: activeTab === 'entries' ? '#eff6ff' : '#f1f5f9',
              color: activeTab === 'entries' ? '#0b5394' : '#64748b',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {entries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ice')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ice' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'ice' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🧊 Ice Blocks Tracker</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wastage')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wastage' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeTab === 'wastage' ? '#16a34a' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🦐 Prawn Head Wastage</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'accounts' ? '3px solid #0b5394' : '3px solid transparent',
            color: activeTab === 'accounts' ? '#0b5394' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📒 Workers Accounts</span>
          <span
            style={{
              background: activeTab === 'accounts' ? '#eff6ff' : '#f1f5f9',
              color: activeTab === 'accounts' ? '#0b5394' : '#64748b',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
            }}
          >
            {summary?.staffAccounts?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('net')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'net' ? '3px solid #7c3aed' : '3px solid transparent',
            color: activeTab === 'net' ? '#7c3aed' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📊 Daily Net Summary</span>
        </button>
      </div>

      {/* TAB 1: DAILY WORK & ATTENDANCE ENTRIES */}
      {activeTab === 'entries' && (
        <>
          {/* Active worker filter notice */}
          {selectedWorkerFilter && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '8px 14px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 700 }}>
                Showing work records for: <strong>{selectedWorkerFilter}</strong>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedWorkerFilter('');
                  setSearch('');
                  loadEntries();
                }}
                style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}
              >
                Clear Worker Filter ✕
              </button>
            </div>
          )}

          {/* Search & Filter Card */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: '16px' }}>
            <form onSubmit={handleSearchSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  alignItems: 'flex-end',
                }}
              >
                {/* Search Worker Name */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    Worker Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Quick Date Presets */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    Period Preset
                  </label>
                  <select
                    className="form-select"
                    value={dateFilter}
                    onChange={(e) => handleDatePreset(e.target.value)}
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setDateFilter('custom');
                    }}
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setDateFilter('custom');
                    }}
                  />
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    Payment Status
                  </label>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending Only</option>
                    <option value="Paid">Paid Only</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      height: '42px',
                      background: '#0b5394',
                      color: '#ffffff',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <SearchIcon size={15} color="#ffffff" /> Search
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleClearFilters}
                    style={{ height: '42px', padding: '0 12px', color: '#64748b' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Entries Content */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {loading ? (
              <div className="spinner" style={{ margin: '40px auto' }}></div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                <StaffIcon size={44} color="#94a3b8" />
                <h4 style={{ margin: '14px 0 6px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  No Work Entries Found
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Click <strong>"+ Add Work Entry"</strong> or <strong>"⚡ Bulk Attendance"</strong> above to record staff labor.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (Visible on Mobile & Tablet) */}
                <div className="mobile-bills-list" style={{ padding: '12px' }}>
                  {entries.map((entry) => (
                    <div key={entry._id} className="mobile-bill-card">
                      {/* Header */}
                      <div className="mobile-bill-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0b5394' }}>
                            {entry.staffName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: '#475569',
                              fontWeight: 600,
                            }}
                          >
                            {entry.workType?.split('/')[0]?.trim() || 'Work'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                            {formatDate(entry.date)}
                          </span>
                          <span
                            className={`badge ${entry.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                            style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px' }}
                          >
                            {entry.paymentStatus}
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px', padding: '6px 0' }}>
                        <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>WEIGHT</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {entry.quantity} kg
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>RATE</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            ₹{entry.price}/kg
                          </div>
                        </div>

                        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700 }}>TOTAL WAGE</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0b5394' }}>
                            {formatCurrency(entry.totalAmount)}
                          </div>
                        </div>
                      </div>

                      {entry.notes && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', padding: '2px 0' }}>
                          "{entry.notes}"
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mobile-bill-actions">
                        <button
                          className={`btn btn-sm ${entry.paymentStatus === 'Paid' ? 'btn-ghost' : 'btn-primary'}`}
                          style={
                            entry.paymentStatus === 'Paid'
                              ? { color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0' }
                              : { background: '#16a34a', color: '#ffffff' }
                          }
                          onClick={() => handleTogglePayment(entry)}
                        >
                          <CheckIcon size={14} />
                          <span>{entry.paymentStatus === 'Paid' ? 'Paid ✓' : 'Mark Paid'}</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(entry)}
                        >
                          <EditIcon size={14} />
                          <span>Edit</span>
                        </button>

                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          <TrashIcon size={14} color="#ef4444" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="table-container desktop-only-table" style={{ margin: 0, border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Worker Name</th>
                        <th>Work Category</th>
                        <th className="text-right">Weight (KG)</th>
                        <th className="text-right">Rate (₹/KG)</th>
                        <th className="text-right">Total Wages</th>
                        <th className="text-center">Payment Status</th>
                        <th className="text-center" style={{ width: '220px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry._id}>
                          <td>{formatDate(entry.date)}</td>
                          <td>
                            <strong
                              style={{ color: '#0b5394', cursor: 'pointer' }}
                              onClick={() => handleViewWorkerHistory(entry.staffName)}
                              title="Click to view history for this worker"
                            >
                              {entry.staffName}
                            </strong>
                            {entry.staffPhone && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{entry.staffPhone}</div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                              {entry.workType || 'General Processing'}
                            </span>
                            {entry.shift && entry.shift !== 'Full Day' && (
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '6px' }}>
                                ({entry.shift})
                              </span>
                            )}
                          </td>
                          <td className="text-right" style={{ fontWeight: 700 }}>
                            {entry.quantity} kg
                          </td>
                          <td className="text-right">₹{entry.price?.toFixed(2)}</td>
                          <td className="text-right" style={{ fontWeight: 800, color: '#0b5394' }}>
                            {formatCurrency(entry.totalAmount)}
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge ${entry.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleTogglePayment(entry)}
                              title="Click to toggle payment status"
                            >
                              {entry.paymentStatus}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="action-buttons" style={{ justifyContent: 'center' }}>
                              <button
                                className={`btn btn-sm ${entry.paymentStatus === 'Paid' ? 'btn-ghost' : 'btn-primary'}`}
                                style={
                                  entry.paymentStatus === 'Paid'
                                    ? { padding: '4px 8px', fontSize: '0.75rem', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }
                                    : { padding: '4px 8px', fontSize: '0.75rem', background: '#16a34a', color: '#ffffff' }
                                }
                                onClick={() => handleTogglePayment(entry)}
                                title={entry.paymentStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
                              >
                                <CheckIcon size={13} /> {entry.paymentStatus === 'Paid' ? 'Paid' : 'Pay'}
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleOpenEdit(entry)}
                                title="Edit entry"
                              >
                                <EditIcon size={13} /> Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', color: '#ef4444' }}
                                onClick={() => handleDeleteEntry(entry)}
                                title="Delete entry"
                              >
                                <TrashIcon size={13} color="#ef4444" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ALL ACCOUNTS BREAKDOWN ("how much they worked for all accounts") */}
      {activeTab === 'accounts' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Worker Accounts & Wage Ledger
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Cumulative weight processed, total wages earned, payments settled, and outstanding balance for every staff member
            </p>
          </div>

          {!summary?.staffAccounts || summary.staffAccounts.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
              <StaffIcon size={40} color="#94a3b8" />
              <p style={{ marginTop: '12px' }}>No worker accounts recorded yet.</p>
            </div>
          ) : (
            <>
              {/* Mobile View for Accounts */}
              <div className="mobile-bills-list" style={{ padding: '12px' }}>
                {summary.staffAccounts.map((acc) => (
                  <div key={acc.staffName} className="mobile-bill-card" style={{ borderLeft: acc.pendingBalance > 0 ? '4px solid #ea580c' : '4px solid #16a34a' }}>
                    <div className="mobile-bill-header">
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#0b5394' }}>{acc.staffName}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          {acc.daysWorkedCount} days worked • {acc.totalEntries} sessions
                        </div>
                      </div>
                      <span
                        className={`badge ${acc.pendingBalance > 0 ? 'badge-amber' : 'badge-green'}`}
                        style={{ fontWeight: 800, fontSize: '0.72rem' }}
                      >
                        {acc.pendingBalance > 0 ? `Due: ${formatCurrency(acc.pendingBalance)}` : 'Settled ✓'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '6px 0' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>TOTAL PROCESSED</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {acc.totalKg} kg
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Avg ₹{acc.avgRate}/kg</div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>TOTAL EARNED</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0b5394' }}>
                          {formatCurrency(acc.totalEarned)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#16a34a' }}>Paid: {formatCurrency(acc.totalPaid)}</div>
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleViewWorkerHistory(acc.staffName)}
                      style={{ width: '100%', marginTop: '4px', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      View All Entries for {acc.staffName} →
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop Table View for Accounts */}
              <div className="table-container desktop-only-table" style={{ margin: 0, border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Worker Name</th>
                      <th className="text-center">Days Worked</th>
                      <th className="text-right">Total KG</th>
                      <th className="text-right">Avg Rate (₹/kg)</th>
                      <th className="text-right">Total Wages Earned</th>
                      <th className="text-right">Amount Paid</th>
                      <th className="text-right">Pending Balance</th>
                      <th className="text-center" style={{ width: '160px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.staffAccounts.map((acc) => (
                      <tr key={acc.staffName}>
                        <td>
                          <strong
                            style={{ color: '#0b5394', cursor: 'pointer' }}
                            onClick={() => handleViewWorkerHistory(acc.staffName)}
                            title="Click to view work log"
                          >
                            {acc.staffName}
                          </strong>
                          {acc.lastWorkedDate && (
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              Last active: {formatDate(acc.lastWorkedDate)}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="badge badge-blue">{acc.daysWorkedCount} days</span>
                        </td>
                        <td className="text-right" style={{ fontWeight: 700 }}>
                          {acc.totalKg} kg
                        </td>
                        <td className="text-right">₹{acc.avgRate?.toFixed(2)}</td>
                        <td className="text-right" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(acc.totalEarned)}
                        </td>
                        <td className="text-right" style={{ fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(acc.totalPaid)}
                        </td>
                        <td className="text-right">
                          <strong
                            style={{
                              color: acc.pendingBalance > 0 ? '#ea580c' : '#16a34a',
                              fontSize: '0.96rem',
                            }}
                          >
                            {formatCurrency(acc.pendingBalance)}
                          </strong>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewWorkerHistory(acc.staffName)}
                            style={{ fontSize: '0.78rem', fontWeight: 700 }}
                          >
                            View Entries →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: ICE BLOCKS USED TRACKER */}
      {activeTab === 'ice' && <IceTracker />}

      {/* TAB 4: PRAWN HEAD WASTAGE SALES TRACKER */}
      {activeTab === 'wastage' && <WastageTracker />}

      {/* TAB 5: CONSOLIDATED DAILY OPERATIONS & NET SUMMARY */}
      {activeTab === 'net' && <DailyNetSummary />}

      {/* MODAL: SINGLE WORK ENTRY (CREATE / EDIT) */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {editingEntry ? 'Edit Work Entry' : 'Record Staff Work'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveEntry}>
              {/* Date */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  Work Date *
                </label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Staff Name with Quick Chips */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  Staff / Worker Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter worker name..."
                  required
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                />

                {/* Suggestions Chips from existing staff */}
                {staffNames.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>
                      Suggestions:
                    </span>
                    {staffNames.slice(0, 6).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setFormData({ ...formData, staffName: name })}
                        style={{
                          background: formData.staffName === name ? '#0b5394' : '#f1f5f9',
                          color: formData.staffName === name ? '#ffffff' : '#334155',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity (KG) and Price (₹/KG) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Quantity (KG) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="e.g. 150.5"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Price / KG (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 15"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              </div>

              {/* Live Total Wage Calculation Box */}
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700 }}>
                    TOTAL WAGE CALCULATION
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {liveQty || 0} kg × ₹{livePrice || 0}/kg
                  </div>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0b5394' }}>
                  {formatCurrency(liveTotal)}
                </div>
              </div>

              {/* Work Type & Payment Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Work Type
                  </label>
                  <select
                    className="form-select"
                    value={formData.workType}
                    onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                  >
                    <option value="Peeling / Seafood Processing">Peeling / Processing</option>
                    <option value="Head-On / De-heading">Head-On / De-heading</option>
                    <option value="Grading & Sorting">Grading & Sorting</option>
                    <option value="Packing & Loading">Packing & Loading</option>
                    <option value="Ice & Cold Storage">Ice & Cold Storage</option>
                    <option value="General Labor">General Labor</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Payment Status
                  </label>
                  <select
                    className="form-select"
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  >
                    <option value="Pending">Pending (Pay Later)</option>
                    <option value="Paid">Paid (Settled Now)</option>
                  </select>
                </div>
              </div>

              {/* Optional Notes */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. morning shift, batch 2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5, background: '#0b5394', fontWeight: 800 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Work Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK ATTENDANCE RECORDING */}
      {bulkModalOpen && (
        <div className="modal-backdrop" onClick={() => setBulkModalOpen(false)}>
          <div
            className="modal-content fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  ⚡ Bulk Staff Attendance Entry
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Quickly record weights and rates for multiple workers on the same date
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setBulkModalOpen(false)}>✕</button>
            </div>

            {/* Date Picker for Bulk */}
            <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b5394', display: 'block', marginBottom: '4px' }}>
                Batch Work Date:
              </label>
              <input
                type="date"
                className="form-input"
                style={{ maxWidth: '220px' }}
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
              />
            </div>

            {/* Rows list */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '14px' }}>
              {bulkRows.map((row, idx) => {
                const rowQty = parseFloat(row.quantity) || 0;
                const rowPrice = parseFloat(row.price) || 0;
                const rowTotal = Math.round(rowQty * rowPrice * 100) / 100;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr auto',
                      gap: '8px',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Worker Name"
                        value={row.staffName}
                        onChange={(e) => handleBulkRowChange(idx, 'staffName', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="Weight (KG)"
                        value={row.quantity}
                        onChange={(e) => handleBulkRowChange(idx, 'quantity', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="Rate (₹)"
                        value={row.price}
                        onChange={(e) => handleBulkRowChange(idx, 'price', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ textAlign: 'right', paddingRight: '6px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0b5394' }}>
                        {formatCurrency(rowTotal)}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px', color: '#ef4444' }}
                        onClick={() => handleRemoveBulkRow(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddBulkRow}
                style={{ width: '100%', border: '1px dashed #cbd5e1', fontWeight: 700 }}
              >
                + Add Another Worker Row
              </button>
            </div>

            {/* Bulk Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Total Batch Workers: <strong>{bulkRows.filter((r) => r.staffName?.trim()).length}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBulkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBulk}
                  disabled={savingBulk}
                  style={{ background: '#0b5394', fontWeight: 800 }}
                >
                  {savingBulk ? 'Saving Batch...' : 'Save All Workers'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

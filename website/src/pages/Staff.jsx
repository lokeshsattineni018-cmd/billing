import { useState, useEffect, useRef } from 'react';
import { staffAPI } from '../services/api';
import { formatCurrency, formatDate, numberToWords, useToast, Toast } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import VoucherBillModal from '../components/VoucherBillModal';
import {
  StaffIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  ScaleIcon,
  IceIcon,
  RefreshIcon,
  PrintIcon,
} from '../components/Icons';
import IceTracker from '../components/operations/IceTracker';
import WastageTracker from '../components/operations/WastageTracker';
import DailyNetSummary from '../components/operations/DailyNetSummary';
import StaffAttendanceCalendar from '../components/StaffAttendanceCalendar';
import { SkeletonTable } from '../components/Skeleton';
import ganeshaImg from '../assets/ganesha.jpg';
import durgaImg from '../assets/durga.jpg';
import ramDarbarImg from '../assets/ram_darbar.jpg';

const BULK_DRAFT_KEY = 'srsf_bulk_worker_draft';

function getInitialBulkDraft() {
  try {
    const raw = localStorage.getItem(BULK_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

export default function Staff() {
  const { t, lang } = useLanguage();
  const { toast, showToast } = useToast();
  const { user } = useAuth();
  const canEditDelete = user?.role === 'admin' || user?.role === 'owner';

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

  // In-app Voucher Viewer Modal State (Like normal bill page with WhatsApp & Print)
  const [viewingVoucher, setViewingVoucher] = useState(null);

  // Single Worker Entry Bill Print State
  const [activeBillEntry, setActiveBillEntry] = useState(null);
  const singleBillRef = useRef(null);

  // Single Worker Full Statement Bill Print State
  const [statementWorker, setStatementWorker] = useState(null);
  const [statementEntries, setStatementEntries] = useState([]);
  const [statementSummary, setStatementSummary] = useState(null);
  const [printingStatement, setPrintingStatement] = useState(false);
  const workerStatementRef = useRef(null);

  // Bulk Entry Modal with Persistent Draft across pages & tab changes
  const savedBulkDraft = getInitialBulkDraft();
  const [bulkModalOpen, setBulkModalOpen] = useState(() => !!savedBulkDraft?.isOpen);
  const [bulkDate, setBulkDate] = useState(() => savedBulkDraft?.date || new Date().toISOString().split('T')[0]);
  const [bulkRows, setBulkRows] = useState(() => savedBulkDraft?.rows || [
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
    { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
  ]);
  const [savingBulk, setSavingBulk] = useState(false);

  // Auto-save bulk draft to localStorage whenever rows, date or modal state change
  useEffect(() => {
    try {
      const hasContent = bulkRows.some(
        (r) => (r.staffName && r.staffName.trim()) || (r.quantity && parseFloat(r.quantity) > 0) || (r.price && parseFloat(r.price) > 0)
      );
      if (hasContent || bulkModalOpen) {
        localStorage.setItem(
          BULK_DRAFT_KEY,
          JSON.stringify({
            date: bulkDate,
            rows: bulkRows,
            isOpen: bulkModalOpen,
            savedAt: new Date().toISOString(),
          })
        );
      } else {
        localStorage.removeItem(BULK_DRAFT_KEY);
      }
    } catch (e) {}
  }, [bulkDate, bulkRows, bulkModalOpen]);

  // Selected Worker filter from Accounts tab
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState('');

  useEffect(() => {
    loadAllData();
  }, [dateFilter, dateFrom, dateTo, statusFilter, workTypeFilter, selectedWorkerFilter]);

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
      const params = {};
      if (dateFilter) params.dateFilter = dateFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await staffAPI.getSummary(params);
      setSummary(res.data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load summary:', err);
      }
    }
  };

  // Generate & View Worker Wage Bill (In-app viewer with WhatsApp & Print)
  const handlePrintEntryBill = (entry, index = 0) => {
    const vNo = entry.voucherNo || (entries.length > 0 ? `WB-${entries.length - index}` : 'WB-1');
    setActiveBillEntry(entry);
    setViewingVoucher({
      type: 'worker',
      data: entry,
      voucherNo: vNo,
    });
  };

  // Generate & View Statement Bill for a single worker (In-app viewer with WhatsApp & Print)
  const handlePrintWorkerStatement = async (workerName) => {
    if (!workerName) return;
    setPrintingStatement(true);
    showToast(`Preparing wage bill statement for ${workerName}...`, 'info');
    try {
      const params = { search: workerName };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await staffAPI.getAll(params);
      const workerRows = (res.data.entries || []).filter(
        (e) => e.staffName.toLowerCase() === workerName.toLowerCase()
      );

      const acc = summary?.staffAccounts?.find((a) => a.staffName.toLowerCase() === workerName.toLowerCase());

      const totalKg = Math.round(workerRows.reduce((sum, r) => sum + (r.quantity || 0), 0) * 100) / 100;
      const totalEarned = Math.round(workerRows.reduce((sum, r) => sum + (r.totalAmount || 0), 0) * 100) / 100;
      const totalPaid = Math.round(workerRows.reduce((sum, r) => sum + (r.paymentStatus === 'Paid' ? r.totalAmount : (r.amountPaid || 0)), 0) * 100) / 100;
      const pendingBalance = Math.round((totalEarned - totalPaid) * 100) / 100;

      const stmtSummary = {
        totalKg,
        totalEarned,
        totalPaid,
        pendingBalance,
        staffPhone: workerRows[0]?.staffPhone || acc?.staffPhone || '',
        daysWorkedCount: acc?.daysWorkedCount || new Set(workerRows.map(r => r.date?.split('T')[0])).size,
      };

      setStatementWorker(workerName);
      setStatementEntries(workerRows);
      setStatementSummary(stmtSummary);

      setViewingVoucher({
        type: 'statement',
        data: {
          workerName,
          entries: workerRows,
          summary: stmtSummary,
        },
        voucherNo: `#STMT-${workerName.replace(/\s+/g, '').slice(0, 6).toUpperCase()}`,
      });
    } catch (err) {
      showToast('Failed to generate worker statement bill', 'error');
    } finally {
      setPrintingStatement(false);
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

  const handleCopyYesterdayTeam = () => {
    const entriesBeforeBulkDate = entries.filter((e) => {
      const eDate = e.date ? e.date.split('T')[0] : '';
      return eDate < bulkDate;
    });

    let targetEntries = [];
    if (entriesBeforeBulkDate.length > 0) {
      const sorted = [...entriesBeforeBulkDate].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const mostRecentDate = sorted[0].date ? sorted[0].date.split('T')[0] : '';
      targetEntries = sorted.filter((e) => (e.date ? e.date.split('T')[0] : '') === mostRecentDate);
    } else if (entries.length > 0) {
      targetEntries = entries.slice(0, 20);
    }

    if (targetEntries.length === 0) {
      if (staffNames.length > 0) {
        const rows = staffNames.slice(0, 10).map((name) => {
          const sName = typeof name === 'string' ? name : name.staffName;
          return {
            staffName: sName,
            quantity: '',
            price: '30',
            workType: 'Peeling / Seafood Processing',
            paymentStatus: 'Pending',
          };
        });
        setBulkRows(rows);
        showToast(`Loaded ${rows.length} workers from registry!`, 'success');
        return;
      }
      showToast('No previous worker records found to copy', 'error');
      return;
    }

    const seen = new Set();
    const rows = [];
    for (const item of targetEntries) {
      if (item.staffName && !seen.has(item.staffName.trim().toLowerCase())) {
        seen.add(item.staffName.trim().toLowerCase());
        rows.push({
          staffName: item.staffName,
          quantity: '',
          price: item.price !== undefined ? String(item.price) : '30',
          workType: item.workType || 'Peeling / Seafood Processing',
          paymentStatus: 'Pending',
        });
      }
    }

    setBulkRows(rows);
    showToast(t('copyYesterdaySuccess') || `Loaded ${rows.length} workers from previous team!`, 'success');
  };

  const handleClearDraft = () => {
    if (window.confirm(t('discardDraftConfirm') || 'Clear unsaved draft entries?')) {
      localStorage.removeItem(BULK_DRAFT_KEY);
      setBulkRows([
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
        { staffName: '', quantity: '', price: '', workType: 'Peeling / Seafood Processing', paymentStatus: 'Pending' },
      ]);
      setBulkModalOpen(false);
      showToast('Draft entries cleared', 'info');
    }
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
      localStorage.removeItem(BULK_DRAFT_KEY);
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
            {activeTab === 'ice' ? (
              <>
                <IceIcon size={24} color="#0284c7" />
                <span>{t('iceTrackerTitle') || 'Ice Blocks Usage & Tracker'}</span>
              </>
            ) : activeTab === 'wastage' ? (
              <>
                <ScaleIcon size={24} color="#16a34a" />
                <span>{t('wastageTrackerTitle') || 'Prawn Head Wastage Sales'}</span>
              </>
            ) : activeTab === 'accounts' ? (
              <>
                <span style={{ fontSize: '1.3rem' }}>📒</span>
                <span>{t('workerAccountsTitle') || 'Worker Accounts & Wage Ledger'}</span>
              </>
            ) : activeTab === 'net' ? (
              <>
                <span style={{ fontSize: '1.3rem' }}>📊</span>
                <span>{t('dailyNetTitle') || 'Daily Operations Net Summary'}</span>
              </>
            ) : activeTab === 'calendar' ? (
              <>
                <span style={{ fontSize: '1.3rem' }}>📅</span>
                <span>{t('attendanceCalendarTitle') || 'Staff Attendance Calendar'}</span>
              </>
            ) : (
              <>
                <StaffIcon size={24} color="#0b5394" />
                <span>{t('workerLaborTitle') || t('staff') || 'Workers Labor & Daily Operations'}</span>
              </>
            )}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {activeTab === 'ice'
              ? (t('iceTrackerSubtitle') || 'Track daily ice block purchases, suppliers, recipients, factory usage & cooling expenses')
              : activeTab === 'wastage'
              ? (t('wastageTrackerSubtitle') || 'Track daily prawn head and shell byproduct sales, rates, and extra factory revenue')
              : activeTab === 'accounts'
              ? (t('workerAccountsSubtitle') || 'Cumulative weight processed, total wages earned, settlements and balances for all staff')
              : activeTab === 'net'
              ? (t('dailyNetSubtitle') || 'Consolidated daily financial overview: worker wages + ice expenses vs. prawn head revenue')
              : activeTab === 'calendar'
              ? (t('attendanceCalendarSubtitle') || 'Monthly calendar overview of worker shifts, attendance and activity')
              : (t('workerLaborSubtitle') || t('staffSubtitle') || 'Record and manage daily staff labor, peeling work, attendance and wages')}
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
            <span>{lang === 'te' ? 'రిఫ్రెష్' : 'Refresh'}</span>
          </button>

          {activeTab === 'entries' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setBulkModalOpen(!bulkModalOpen)}
                style={{ fontWeight: 700, border: '1.5px solid #0b5394', color: '#0b5394' }}
              >
                ⚡ {bulkModalOpen ? (t('hideBulkEntry') || 'Hide Bulk Entry') : (t('bulkAttendance') || 'Bulk Attendance')}
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
                <span>{t('addWorkEntry') || 'Add Work Entry'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px',
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
          <span>👥 {t('workerLaborTitle') || 'Workers Labor'}</span>
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
          <span>🧊 {t('iceBlocks') || 'Ice Blocks Tracker'}</span>
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
          <span>🦐 {t('prawnHeadWastage') || 'Prawn Head Wastage'}</span>
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
          <span>📒 {t('workerAccounts') || 'Workers Accounts'}</span>
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
          <span>📊 {t('dailyOperations') || 'Daily Net Summary'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'calendar' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeTab === 'calendar' ? '#16a34a' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📅 {t('attendanceCalendar') || 'Attendance Calendar'}</span>
        </button>
      </div>

      {/* TAB 1: DAILY WORK & ATTENDANCE ENTRIES */}
      {activeTab === 'entries' && (
        <>
          {/* Worker KPI Summary Cards */}
          {(() => {
            const periodLabel = dateFilter === 'today' ? "Today's" : dateFilter === 'yesterday' ? "Yesterday's" : dateFilter === 'week' ? '7-Day' : dateFilter === 'month' ? "This Month's" : (dateFilter === 'all' && !dateFrom) ? 'All-Time' : 'Filtered';
            const badgeLabel = dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? '7 Days' : dateFilter === 'month' ? 'Month' : (dateFilter === 'all' && !dateFrom) ? 'All Time' : 'Custom';
            return (
          <div className="dashboard-stats-grid" style={{ marginBottom: '20px' }}>
            {/* Period Workers */}
            <div className="stat-card-compact" style={{ borderLeft: '4px solid #0b5394' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {periodLabel} Workers
                </span>
                <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{badgeLabel}</span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
                {summary?.today?.todayWorkersCount || 0}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>present</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                Total {summary?.overall?.totalWorkers || 0} active workers in registry
              </div>
            </div>

            {/* Period Weight Processed */}
            <div className="stat-card-compact" style={{ borderLeft: '4px solid #0891b2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {periodLabel} Processed
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

            {/* Period Total Wages */}
            <div className="stat-card-compact" style={{ borderLeft: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {periodLabel} Wages
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

            {/* Period Outstanding Wages to Pay */}
            <div className="stat-card-compact" style={{ borderLeft: '4px solid #ea580c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {periodLabel} Pending
                </span>
                <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>To Pay</span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                {formatCurrency(dateFilter === 'all' && !dateFrom ? summary?.overall?.totalPending || 0 : summary?.today?.periodPending || 0)}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                Paid in Period: {formatCurrency(dateFilter === 'all' && !dateFrom ? summary?.overall?.totalPaid || 0 : summary?.today?.periodPaid || 0)} • Due: {formatCurrency(summary?.overall?.totalPending || 0)}
              </div>
            </div>
          </div>
            );
          })()}

          {/* INLINE: BULK ATTENDANCE RECORDING */}
          {bulkModalOpen && (
            <div
              className="card fade-in"
              style={{
                padding: '20px',
                marginBottom: '20px',
                border: '1.5px solid #bfdbfe',
                background: '#fafcff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0b5394', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>⚡ {t('bulkStaffAttendanceEntry') || 'Bulk Staff Attendance Entry'}</span>
                    {bulkRows.some((r) => r.staffName?.trim() || r.quantity) && (
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                        ✓ {t('draftSaved') || 'Draft Auto-Saved'}
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    {t('bulkStaffSubtitle') || 'Quickly record weights and rates for multiple workers on the same date'}
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setBulkModalOpen(false)} style={{ fontSize: '1.1rem' }}>✕</button>
              </div>

              {/* Date Picker for Bulk & Copy Yesterday's Team */}
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', display: 'inline-block' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b5394', display: 'block', marginBottom: '4px' }}>
                    {t('batchWorkDate') || 'Batch Work Date'}:
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ maxWidth: '220px' }}
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyYesterdayTeam}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#eff6ff',
                    border: '1.5px solid #0b5394',
                    color: '#0b5394',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    boxShadow: '0 2px 6px rgba(11, 83, 148, 0.08)',
                  }}
                  title="Auto-fill worker names from yesterday's attendance team"
                >
                  <span>{t('copyYesterdayTeam') || "⚡ Copy Yesterday's Team"}</span>
                </button>
              </div>

              {/* Column Headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto',
                  gap: '8px',
                  padding: '6px 10px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('workerName') || 'Worker Name'}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('weightKg') || 'Weight (KG)'}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('ratePerKg') || 'Rate (₹/KG)'}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>{t('total') || 'Total'}</span>
                <span style={{ width: '28px' }}></span>
              </div>

              {/* Rows list */}
              <div style={{ marginBottom: '14px' }}>
                {bulkRows.map((row, idx) => {
                  const rowQty = parseFloat(row.quantity) || 0;
                  const rowPrice = parseFloat(row.price) || 0;
                  const rowTotal = Math.round(rowQty * rowPrice * 100) / 100;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto',
                        gap: '8px',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        marginBottom: '6px',
                      }}
                    >
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('workerName') || "Worker Name"}
                        value={row.staffName}
                        onChange={(e) => handleBulkRowChange(idx, 'staffName', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0"
                        value={row.quantity}
                        onChange={(e) => handleBulkRowChange(idx, 'quantity', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0"
                        value={row.price}
                        onChange={(e) => handleBulkRowChange(idx, 'price', e.target.value)}
                        style={{ height: '36px', fontSize: '0.85rem' }}
                      />
                      <div style={{ textAlign: 'right', paddingRight: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0b5394' }}>
                          {formatCurrency(rowTotal)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px', color: '#ef4444', width: '28px' }}
                        onClick={() => handleRemoveBulkRow(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddBulkRow}
                  style={{ width: '100%', border: '1px dashed #cbd5e1', fontWeight: 700, marginTop: '4px' }}
                >
                  {t('addAnotherWorkerRow') || '+ Add Another Worker Row'}
                </button>
              </div>

              {/* Bulk Footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {t('totalBatchWorkers') || 'Total Batch Workers'}: <strong>{bulkRows.filter((r) => r.staffName?.trim()).length}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {bulkRows.some((r) => r.staffName?.trim() || r.quantity) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleClearDraft}
                      style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      🗑️ {t('clearDraft') || 'Clear Draft'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBulkModalOpen(false)}
                  >
                    {t('cancel') || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveBulk}
                    disabled={savingBulk}
                    style={{ background: '#0b5394', fontWeight: 800 }}
                  >
                    {savingBulk ? (t('saving') || 'Saving Batch...') : (t('saveAllWorkers') || 'Save All Workers')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active worker filter notice with Print Worker Wage Bill button */}
          {selectedWorkerFilter && (
            <div
              style={{
                background: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.88rem', color: '#1e40af', fontWeight: 700 }}>
                  Showing work records for: <strong>{selectedWorkerFilter}</strong>
                </span>
                <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                  {entries.length} entries
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handlePrintWorkerStatement(selectedWorkerFilter)}
                  disabled={printingStatement}
                  style={{
                    background: '#7c3aed',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)',
                  }}
                  title={`Print official settlement / wage bill for ${selectedWorkerFilter}`}
                >
                  <PrintIcon size={14} color="#ffffff" />
                  <span>{printingStatement ? 'Generating...' : `Print ${selectedWorkerFilter}'s Wage Bill`}</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelectedWorkerFilter('');
                    setSearch('');
                    loadEntries();
                  }}
                  style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}
                >
                  Clear Worker Filter ✕
                </button>
              </div>
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
                    {t('workerName') || 'Worker Name'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={lang === 'te' ? 'కార్మికుని పేరు వెతకండి...' : 'Search name...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Quick Date Presets */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    {lang === 'te' ? 'కాల పరిమితి' : 'Period Preset'}
                  </label>
                  <select
                    className="form-select"
                    value={dateFilter}
                    onChange={(e) => handleDatePreset(e.target.value)}
                  >
                    <option value="all">{lang === 'te' ? 'అన్ని తేదీలు' : 'All Dates'}</option>
                    <option value="today">{t('today') || 'Today'}</option>
                    <option value="yesterday">{t('yesterday') || 'Yesterday'}</option>
                    <option value="week">{lang === 'te' ? 'గత 7 రోజులు' : 'Past 7 Days'}</option>
                    <option value="month">{t('thisMonth') || 'This Month'}</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="filter-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    {lang === 'te' ? 'ప్రారంభ తేదీ' : 'From Date'}
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
                    {lang === 'te' ? 'ముగింపు తేదీ' : 'To Date'}
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
                    {t('paymentStatus') || 'Payment Status'}
                  </label>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">{lang === 'te' ? 'అన్ని రకాలు' : 'All Statuses'}</option>
                    <option value="Pending">{lang === 'te' ? 'బాకీ ఉన్నవి మాత్రమే' : 'Pending Only'}</option>
                    <option value="Paid">{lang === 'te' ? 'చెల్లించినవి మాత్రమే' : 'Paid Only'}</option>
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
                    <SearchIcon size={15} color="#ffffff" />
                    <span>{lang === 'te' ? 'వెతకండి' : 'Filter'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClearFilters}
                    style={{
                      height: '42px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Clear all filters"
                  >
                    <span>{lang === 'te' ? 'రీసెట్' : 'Reset'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Entries Content */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {loading ? (
              <SkeletonTable rows={7} cols={6} hasHeader={false} />
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
                  {entries.map((entry, index) => (
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
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePrintEntryBill(entry, index)}
                          style={{ color: '#7c3aed', borderColor: '#ddd6fe', fontWeight: 800, background: '#f5f3ff' }}
                        >
                          <PrintIcon size={14} color="#7c3aed" />
                          <span>Bill</span>
                        </button>

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

                        {canEditDelete && (
                          <>
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
                          </>
                        )}
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
                        <th className="text-center" style={{ width: '270px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => (
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
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  background: '#f5f3ff',
                                  color: '#7c3aed',
                                  border: '1px solid #ddd6fe',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                onClick={() => handlePrintEntryBill(entry, index)}
                                title="Generate & View Worker Wage Bill"
                              >
                                <PrintIcon size={13} color="#7c3aed" /> Bill
                              </button>
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
                              {canEditDelete && (
                                <>
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
                                </>
                              )}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewWorkerHistory(acc.staffName)}
                        style={{ fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        View Entries →
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePrintWorkerStatement(acc.staffName)}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background: '#f5f3ff',
                          color: '#7c3aed',
                          border: '1px solid #ddd6fe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <PrintIcon size={14} color="#7c3aed" /> Bill
                      </button>
                    </div>
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
                      <th className="text-center" style={{ width: '220px' }}>Action</th>
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
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewWorkerHistory(acc.staffName)}
                              style={{ fontSize: '0.78rem', fontWeight: 700 }}
                            >
                              Entries →
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => handlePrintWorkerStatement(acc.staffName)}
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                background: '#f5f3ff',
                                color: '#7c3aed',
                                border: '1px solid #ddd6fe',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title={`Print complete wage statement bill for ${acc.staffName}`}
                            >
                              <PrintIcon size={13} color="#7c3aed" /> Bill
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
      )}

      {/* TAB 3: ICE BLOCKS USED TRACKER */}
      {activeTab === 'ice' && <IceTracker />}

      {/* TAB 4: PRAWN HEAD WASTAGE SALES TRACKER */}
      {activeTab === 'wastage' && <WastageTracker />}

      {/* TAB 5: CONSOLIDATED DAILY OPERATIONS & NET SUMMARY */}
      {activeTab === 'net' && <DailyNetSummary />}

      {/* TAB 6: WORKER ATTENDANCE CALENDAR */}
      {activeTab === 'calendar' && (
        <StaffAttendanceCalendar
          entries={entries}
          staffNames={staffNames}
          defaultWorker={selectedWorkerFilter}
        />
      )}

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

      {/* ── 1. HIDDEN PRINTABLE BILL: SINGLE WORKER WAGE VOUCHER ── */}
      {activeBillEntry && (
        <div ref={singleBillRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div style={{ border: '1.5px solid #0b5394', background: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #0b5394', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 'bold', color: '#0b5394' }}>
              <div>WORKER BILL</div>
              <div style={{ textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '1px' }}>॥ జై శ్రీరామ్ ॥</div>
              <div>Cell: 9441429745</div>
            </div>

            {/* Company Header */}
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

            {/* Voucher No & Date Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.85rem' }}>
              <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Voucher No.</span>
                <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                  #{activeBillEntry.voucherNo || (viewingVoucher?.voucherNo || 'WB-1')}
                </span>
              </div>
              <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(activeBillEntry.date)}</span>
              </div>
            </div>

            {/* Worker Name Row */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1.5px solid #0b5394', padding: '6px 10px', gap: '10px', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Worker Name:</span>
              <strong style={{ fontSize: '1.05rem', color: '#000000' }}>{activeBillEntry.staffName}</strong>
              {activeBillEntry.staffPhone && (
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                  Cell: <strong>{activeBillEntry.staffPhone}</strong>
                </span>
              )}
            </div>

            {/* Shift & Status Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.82rem' }}>
              <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Work Category & Shift: </span>
                <span style={{ fontWeight: 'bold' }}>{activeBillEntry.workType || 'Processing'} ({activeBillEntry.shift || 'Full Day'})</span>
              </div>
              <div style={{ padding: '5px 10px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Payment Status: </span>
                <span style={{ fontWeight: 'bold', color: activeBillEntry.paymentStatus === 'Paid' ? '#16a34a' : '#d97706' }}>
                  {activeBillEntry.paymentStatus || 'Pending'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 4px', width: '45px' }}>S.No.</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 8px', textAlign: 'left' }}>Work Description / Service</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '120px' }}>Weight (kg)</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '110px' }}>Rate (₹/kg)</th>
                  <th style={{ borderBottom: '1.5px solid #0b5394', padding: '6px', width: '130px', textAlign: 'right' }}>Total Wages (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: '30px', borderBottom: '1px solid #c8d9e8' }}>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', padding: '6px 8px', fontWeight: 'bold' }}>
                    {activeBillEntry.workType || 'Seafood Labor Processing'} ({activeBillEntry.shift || 'Full Day'})
                  </td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>
                    {activeBillEntry.quantity} kg
                  </td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '8px' }}>
                    ₹{Number(activeBillEntry.price).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                    ₹{Number(activeBillEntry.totalAmount).toFixed(2)}
                  </td>
                </tr>
                {/* 2 Blank lines for authentic invoice layout spacing */}
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
                    TOTAL WAGE AMOUNT:
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 10px', fontSize: '1.05rem', fontWeight: 900, color: '#000000' }}>
                    ₹{Number(activeBillEntry.totalAmount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes if present */}
            {activeBillEntry.notes && (
              <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#fafafa' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Notes / Remarks: </span>{activeBillEntry.notes}
              </div>
            )}

            {/* Amount in Words */}
            <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Amount in Words: </span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{numberToWords(activeBillEntry.totalAmount)}</span>
            </div>

            {/* Bank Details & Proprietor Signature (Worker signature removed as requested) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', borderTop: '1.5px solid #0b5394', fontSize: '0.74rem', lineHeight: '1.4' }}>
              <div style={{ borderRight: '1.5px solid #0b5394', padding: '8px 12px', background: '#fafafa' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394', marginBottom: '2px', fontSize: '0.76rem' }}>
                  Bank Account Details:
                </div>
                <div><strong>Bank:</strong> Andhra Pragathi Grameena Bank</div>
                <div><strong>A/C No:</strong> 191630100000305</div>
                <div><strong>IFSC:</strong> APGB0003116 &nbsp;|&nbsp; <strong>Branch:</strong> Mutyalapalli</div>
              </div>

              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center', background: '#ffffff' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.8rem' }}>
                  For VIJAYA DURGA SEA FOODS
                </div>
                <div style={{ marginTop: '32px', borderTop: '1px solid #000000', paddingTop: '2px', fontWeight: 'bold', color: '#0b5394' }}>
                  Proprietor / Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. HIDDEN PRINTABLE BILL: WORKER WAGE STATEMENT & SETTLEMENT BILL ── */}
      {statementWorker && statementSummary && (
        <div ref={workerStatementRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div style={{ border: '1.5px solid #0b5394', background: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #0b5394', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 'bold', color: '#0b5394' }}>
              <div>WORKER WAGE STATEMENT & SETTLEMENT BILL</div>
              <div style={{ textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '1px' }}>॥ జై శ్రీరామ్ ॥</div>
              <div>Cell: 9441429745</div>
            </div>

            {/* Company Header */}
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

            {/* Statement No & Date Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.85rem' }}>
              <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Statement No.</span>
                <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                  #STMT-{statementWorker.replace(/\s+/g, '').slice(0, 4).toUpperCase()}-{Date.now().toString().slice(-4)}
                </span>
              </div>
              <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(new Date())}</span>
              </div>
            </div>

            {/* Worker Name Row */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1.5px solid #0b5394', padding: '6px 10px', gap: '10px', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Worker Name:</span>
              <strong style={{ fontSize: '1.05rem', color: '#000000' }}>{statementWorker}</strong>
              {statementSummary.staffPhone && (
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                  Cell: <strong>{statementSummary.staffPhone}</strong>
                </span>
              )}
            </div>

            {/* Period & Days Worked Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #0b5394', fontSize: '0.82rem' }}>
              <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Period: </span>
                <span style={{ fontWeight: 'bold' }}>
                  {dateFrom && dateTo ? `${formatDate(dateFrom)} to ${formatDate(dateTo)}` : dateFilter === 'week' ? 'Past 7 Days' : dateFilter === 'month' ? 'This Month' : 'All-Time Record'}
                </span>
              </div>
              <div style={{ padding: '5px 10px' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Days Worked: </span>
                <span style={{ fontWeight: 'bold' }}>{statementSummary.daysWorkedCount} days ({statementEntries.length} sessions)</span>
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 4px', width: '38px' }}>S.No.</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 6px', width: '85px' }}>Date</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 6px', textAlign: 'left' }}>Work Category & Shift</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 6px', width: '85px', textAlign: 'right' }}>Weight (kg)</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 6px', width: '85px', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 6px', width: '95px', textAlign: 'right' }}>Wages (₹)</th>
                  <th style={{ borderBottom: '1.5px solid #0b5394', padding: '5px 6px', width: '75px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {statementEntries.map((row, idx) => (
                  <tr key={idx} style={{ height: '24px', borderBottom: '1px solid #c8d9e8' }}>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center' }}>{formatDate(row.date)}</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', padding: '4px 6px' }}>{row.workType || 'Processing'} {row.shift && row.shift !== 'Full Day' ? `(${row.shift})` : ''}</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '6px', fontWeight: 'bold' }}>{row.quantity} kg</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '6px' }}>₹{Number(row.price).toFixed(2)}</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '6px', fontWeight: 'bold' }}>₹{Number(row.totalAmount).toFixed(2)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: row.paymentStatus === 'Paid' ? '#16a34a' : '#d97706' }}>{row.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Grand Total Row */}
                <tr style={{ background: '#e8f1f8', borderTop: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ textAlign: 'right', padding: '6px 10px', color: '#0b5394', fontSize: '0.88rem', fontWeight: 900 }}>
                    TOTAL PROCESSED:
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px', fontWeight: 900, color: '#0b5394', borderRight: '1.5px solid #0b5394' }}>
                    {statementSummary.totalKg} kg
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#0b5394', fontWeight: 900, borderRight: '1.5px solid #0b5394' }}>
                    TOTAL:
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.95rem', fontWeight: 900, color: '#000000', borderRight: '1.5px solid #0b5394' }}>
                    ₹{statementSummary.totalEarned.toFixed(2)}
                  </td>
                  <td></td>
                </tr>

                {/* Paid vs Due Row */}
                <tr style={{ background: '#f8fafc', borderTop: '1px solid #0b5394', fontSize: '0.82rem' }}>
                  <td colSpan={3} style={{ textAlign: 'right', padding: '5px 10px', color: '#16a34a', fontWeight: 'bold' }}>
                    Amount Paid: ₹{statementSummary.totalPaid.toFixed(2)}
                  </td>
                  <td colSpan={4} style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 900, fontSize: '0.95rem', color: statementSummary.pendingBalance > 0 ? '#b12704' : '#16a34a' }}>
                    NET BALANCE PAYABLE: ₹{statementSummary.pendingBalance.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Amount in Words */}
            <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Total Earned in Words: </span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{numberToWords(statementSummary.totalEarned)}</span>
            </div>

            {/* Bank Details & Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1.5px solid #0b5394', fontSize: '0.74rem', lineHeight: '1.4' }}>
              <div style={{ borderRight: '1.5px solid #0b5394', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.78rem' }}>
                  Worker Signature / Acknowledgment
                </div>
                <div style={{ marginTop: '28px', borderTop: '1px solid #000000', paddingTop: '2px', fontWeight: 'bold' }}>
                  {statementWorker}
                </div>
              </div>

              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.78rem' }}>
                  For VIJAYA DURGA SEA FOODS
                </div>
                <div style={{ marginTop: '28px', borderTop: '1px solid #000000', paddingTop: '2px', fontWeight: 'bold', color: '#0b5394' }}>
                  Proprietor / Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IN-APP VOUCHER BILL VIEWER MODAL (LIKE NORMAL BILL PAGE WITH WHATSAPP & PRINT) ── */}
      {viewingVoucher && (
        <VoucherBillModal
          isOpen={Boolean(viewingVoucher)}
          onClose={() => setViewingVoucher(null)}
          type={viewingVoucher.type}
          data={viewingVoucher.data}
          voucherNo={viewingVoucher.voucherNo}
        />
      )}
    </div>
  );
}

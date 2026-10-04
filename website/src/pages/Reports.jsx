import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsAPI, billsAPI, staffAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  WhatsAppIcon,
  DownloadIcon,
  FileCheckIcon,
  IceIcon,
  ScaleIcon,
  StaffIcon,
  PrintIcon,
} from '../components/Icons';

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast, showToast } = useToast();

  // Multi-stream tabs: 'sales' | 'ice' | 'workers' | 'wastage' | 'net' | 'outstanding'
  const [activeTab, setActiveTab] = useState('sales');
  const [range, setRange] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stream data states
  const [iceData, setIceData] = useState({ entries: [], summary: null });
  const [loadingIce, setLoadingIce] = useState(false);

  const [staffData, setStaffData] = useState({ entries: [], summary: null });
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [wastageData, setWastageData] = useState({ entries: [], summary: null });
  const [loadingWastage, setLoadingWastage] = useState(false);

  // Outstanding tab state
  const [outstandingData, setOutstandingData] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [outstandingSort, setOutstandingSort] = useState('balance_desc');

  const getDates = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let dateFrom = '';
    let dateTo = '';

    if (range === 'all') {
      dateFrom = '';
      dateTo = '';
    } else if (range === 'today') {
      dateFrom = fmt(now);
      dateTo = fmt(now);
    } else if (range === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      dateFrom = fmt(y);
      dateTo = fmt(y);
    } else if (range === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const m = new Date(now);
      m.setDate(diff);
      dateFrom = fmt(m);
      dateTo = fmt(now);
    } else if (range === 'this_month') {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1);
      const endM = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFrom = fmt(startM);
      dateTo = fmt(endM);
    } else if (range === 'last_month') {
      const startLM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLM = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFrom = fmt(startLM);
      dateTo = fmt(endLM);
    } else if (range === 'custom') {
      dateFrom = customStart;
      dateTo = customEnd;
    }
    return { dateFrom, dateTo };
  };

  useEffect(() => {
    if (activeTab === 'sales' || activeTab === 'net') {
      loadReport();
    }
    if (activeTab === 'ice' || activeTab === 'net') {
      loadIce();
    }
    if (activeTab === 'workers' || activeTab === 'net') {
      loadStaff();
    }
    if (activeTab === 'wastage' || activeTab === 'net') {
      loadWastage();
    }
    if (activeTab === 'outstanding') {
      loadOutstanding();
    }
  }, [range, activeTab]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { range };
      if (range === 'custom') {
        if (!customStart || !customEnd) {
          setLoading(false);
          return;
        }
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await reportsAPI.getSales(params);
      setReport(res.data);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load sales report:', err); }
      showToast('Failed to load sales report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadIce = async () => {
    setLoadingIce(true);
    try {
      const { dateFrom, dateTo } = getDates();
      const [resEntries, resSummary] = await Promise.all([
        staffAPI.getIce({ dateFrom, dateTo, limit: 1000 }),
        staffAPI.getIceSummary({ dateFilter: range, dateFrom, dateTo }),
      ]);
      const entries = resEntries.data.entries || resEntries.data.records || [];
      setIceData({ entries, summary: resSummary.data });
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load ice report:', err); }
    } finally {
      setLoadingIce(false);
    }
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const { dateFrom, dateTo } = getDates();
      const [resEntries, resSummary] = await Promise.all([
        staffAPI.getAll({ dateFrom, dateTo, limit: 1000 }),
        staffAPI.getSummary({ dateFilter: range, dateFrom, dateTo }),
      ]);
      const entries = resEntries.data.entries || resEntries.data.records || [];
      setStaffData({ entries, summary: resSummary.data });
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load staff report:', err); }
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadWastage = async () => {
    setLoadingWastage(true);
    try {
      const { dateFrom, dateTo } = getDates();
      const [resEntries, resSummary] = await Promise.all([
        staffAPI.getWastage({ dateFrom, dateTo, limit: 1000 }),
        staffAPI.getWastageSummary({ dateFilter: range, dateFrom, dateTo }),
      ]);
      const entries = resEntries.data.entries || resEntries.data.records || [];
      setWastageData({ entries, summary: resSummary.data });
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load wastage report:', err); }
    } finally {
      setLoadingWastage(false);
    }
  };

  const loadOutstanding = async () => {
    setLoadingOutstanding(true);
    try {
      const res = await reportsAPI.getOutstanding();
      setOutstandingData(res.data);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load outstanding balances:', err); }
      showToast('Failed to load outstanding balances', 'error');
    } finally {
      setLoadingOutstanding(false);
    }
  };

  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      showToast('Please select both start and end dates', 'error');
      return;
    }
    if (activeTab === 'sales' || activeTab === 'net') loadReport();
    if (activeTab === 'ice' || activeTab === 'net') loadIce();
    if (activeTab === 'workers' || activeTab === 'net') loadStaff();
    if (activeTab === 'wastage' || activeTab === 'net') loadWastage();
  };

  const getReportParams = () => {
    const params = { range };
    if (range === 'custom' && customStart && customEnd) {
      params.startDate = customStart;
      params.endDate = customEnd;
    }
    return params;
  };

  const handleDownloadPDF = () => {
    const params = getReportParams();
    window.open(reportsAPI.downloadPDFUrl(params), '_blank');
  };

  const handleDownloadGSTPDF = () => {
    const params = getReportParams();
    window.open(reportsAPI.downloadGSTPDFUrl(params), '_blank');
  };

  const handleExportGST = () => {
    const params = getReportParams();
    window.open(reportsAPI.exportGSTUrl(params), '_blank');
  };

  const handleShareWhatsApp = async () => {
    if (!report?.whatsappSummary) return;
    const text = report.whatsappSummary;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VIJAYA DURGA AGENCIES - Financial Report',
          text,
        });
        navigate('/');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.location.href = url;
    setTimeout(() => {
      navigate('/');
    }, 400);
  };

  const handleExportCSV = () => {
    const { dateFrom, dateTo } = getDates();
    window.open(billsAPI.exportCSVUrl({ dateFrom, dateTo }), '_blank');
  };

  const handleExportTally = () => {
    const { dateFrom, dateTo } = getDates();
    window.open(billsAPI.exportTallyUrl({ dateFrom, dateTo }), '_blank');
  };

  const handleExportIce = () => {
    const { dateFrom, dateTo } = getDates();
    window.open(staffAPI.exportIceCSVUrl({ dateFrom, dateTo }), '_blank');
  };

  const handleExportStaff = () => {
    const { dateFrom, dateTo } = getDates();
    window.open(staffAPI.exportCSVUrl({ dateFrom, dateTo }), '_blank');
  };

  const handleExportWastage = () => {
    const { dateFrom, dateTo } = getDates();
    window.open(staffAPI.exportWastageCSVUrl({ dateFrom, dateTo }), '_blank');
  };

  const handleSendWhatsAppReminder = (customer) => {
    if (!customer?.reminderMessage) return;
    const cleanPhone = (customer.customerPhone || '').replace(/\D/g, '').slice(-10);
    const encoded = encodeURIComponent(customer.reminderMessage);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopyReminder = (customer) => {
    if (!customer?.reminderMessage) return;
    navigator.clipboard.writeText(customer.reminderMessage);
    showToast(`Payment reminder copied for ${customer.companyName}!`, 'success');
  };

  const summary = report?.summary || {};

  // Dynamic fallback calculation for Ice from entries if summary is 0 or missing
  const iceEntries = iceData.entries || [];
  const totalIceBlocks =
    (iceData.summary?.periodBlocks !== undefined && iceData.summary?.periodBlocks !== 0)
      ? iceData.summary.periodBlocks
      : iceData.summary?.todayBlocks ||
        iceData.summary?.overall?.totalBlocks ||
        iceEntries.reduce((s, e) => s + (Number(e.blocks) || 0), 0);
  const totalIceCost =
    (iceData.summary?.periodCost !== undefined && iceData.summary?.periodCost !== 0)
      ? iceData.summary.periodCost
      : iceData.summary?.todayAmount ||
        iceData.summary?.overall?.totalCost ||
        iceData.summary?.overall?.totalAmount ||
        Math.round(iceEntries.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0) * 100) / 100;
  const avgIceRate =
    totalIceBlocks > 0 ? (totalIceCost / totalIceBlocks).toFixed(2) : '0.00';
  const pendingIceToPlants =
    iceData.summary?.periodPending !== undefined
      ? iceData.summary.periodPending
      : Math.round(
          iceEntries
            .filter((e) => e.paymentStatus === 'Pending')
            .reduce((s, e) => s + (Number(e.totalAmount) || 0), 0) * 100
        ) / 100;

  // Dynamic fallback calculation for Wastage from entries
  const wastageEntries = wastageData.entries || [];
  const totalWastageKg =
    (wastageData.summary?.periodKg !== undefined && wastageData.summary?.periodKg !== 0)
      ? wastageData.summary.periodKg
      : wastageData.summary?.todayKg ||
        wastageData.summary?.overall?.totalKg ||
        Math.round(wastageEntries.reduce((s, e) => s + (Number(e.quantityKg) || 0), 0) * 10) / 10;
  const totalWastageRevenue =
    (wastageData.summary?.periodRevenue !== undefined && wastageData.summary?.periodRevenue !== 0)
      ? wastageData.summary.periodRevenue
      : wastageData.summary?.todayAmount ||
        wastageData.summary?.overall?.totalRevenue ||
        wastageData.summary?.overall?.totalAmount ||
        Math.round(wastageEntries.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0) * 100) / 100;
  const avgWastageRate =
    totalWastageKg > 0 ? (totalWastageRevenue / totalWastageKg).toFixed(2) : '0.00';
  const pendingWastageReceivables =
    wastageData.summary?.periodPending !== undefined
      ? wastageData.summary.periodPending
      : Math.round(
          wastageEntries
            .filter((e) => e.paymentStatus === 'Pending')
            .reduce((s, e) => s + (Number(e.totalAmount) || 0), 0) * 100
        ) / 100;

  // Dynamic fallback calculation for Worker Wages from entries
  const staffEntries = staffData.entries || [];
  const totalWorkerWages =
    (staffData.summary?.today?.todayWages !== undefined && staffData.summary?.today?.todayWages !== 0)
      ? staffData.summary.today.todayWages
      : staffData.summary?.today?.periodTotal ||
        staffData.summary?.overall?.totalWages ||
        Math.round(staffEntries.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0) * 100) / 100;
  const totalWorkerKg =
    (staffData.summary?.today?.todayKg !== undefined && staffData.summary?.today?.todayKg !== 0)
      ? staffData.summary.today.todayKg
      : staffData.summary?.today?.periodKg ||
        staffData.summary?.overall?.totalKg ||
        Math.round(staffEntries.reduce((s, e) => s + (Number(e.quantity) || 0), 0) * 10) / 10;
  const totalWorkerPending =
    staffData.summary?.today?.periodPending !== undefined
      ? staffData.summary.today.periodPending
      : staffData.summary?.overall?.totalPending !== undefined
      ? staffData.summary.overall.totalPending
      : Math.round(
          staffEntries
            .filter((e) => e.paymentStatus !== 'Paid')
            .reduce((s, e) => s + Math.max(0, (e.totalAmount || 0) - (e.amountPaid || 0)), 0) * 100
        ) / 100;
  const totalWorkerPaid =
    staffData.summary?.today?.periodPaid !== undefined
      ? staffData.summary.today.periodPaid
      : staffData.summary?.overall?.totalPaid !== undefined
      ? staffData.summary.overall.totalPaid
      : Math.round(
          staffEntries.reduce((s, e) => s + (e.paymentStatus === 'Paid' ? (e.totalAmount || 0) : (e.amountPaid || 0)), 0) * 100
        ) / 100;

  // Financial Net Aggregation values
  const grossSales = summary?.grossRevenue || 0;
  const wastageRev = totalWastageRevenue;
  const totalDirectInflow = grossSales + wastageRev;

  const iceCost = totalIceCost;
  const workerWages = totalWorkerWages;
  const totalFactoryOutflow = iceCost + workerWages;

  const netOperationalMargin = Math.round((totalDirectInflow - totalFactoryOutflow) * 100) / 100;
  const isNetSurplus = netOperationalMargin >= 0;

  // Filtered & sorted outstanding customers
  const filteredOutstanding = (outstandingData?.customers || [])
    .filter((c) => {
      if (!outstandingSearch) return true;
      const q = outstandingSearch.toLowerCase();
      return (
        (c.companyName || '').toLowerCase().includes(q) ||
        (c.customerPhone || '').includes(q) ||
        (c.companyGstin || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (outstandingSort === 'balance_desc') return b.outstandingBalance - a.outstandingBalance;
      if (outstandingSort === 'balance_asc') return a.outstandingBalance - b.outstandingBalance;
      if (outstandingSort === 'name_asc') return (a.companyName || '').localeCompare(b.companyName || '');
      if (outstandingSort === 'bills_desc') return b.unpaidBillsCount - a.unpaidBillsCount;
      return 0;
    });

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            {activeTab === 'ice'
              ? (lang === 'te' ? '🧊 ఐస్ కొనుగోళ్ల నివేదిక' : '🧊 Ice Bills & Purchases Report')
              : activeTab === 'workers'
              ? (lang === 'te' ? '👷 కూలీల వేతన నివేదిక' : '👷 Worker Wages & Labor Report')
              : activeTab === 'wastage'
              ? (lang === 'te' ? '🦐 రొయ్య తలల వేస్టేజ్ ఆదాయ నివేదిక' : '🦐 Prawn Head Wastage Revenue Report')
              : activeTab === 'net'
              ? (lang === 'te' ? '⚖️ పూర్తి నికర వ్యాపార లాభనష్టాల నివేదిక' : '⚖️ Comprehensive Net Operations & Profit Statement')
              : activeTab === 'outstanding'
              ? (lang === 'te' ? '⚠️ ఖాతాదారుల బాకీల లెడ్జర్' : '⚠️ Customer Outstanding Balances Ledger')
              : (t('salesFinancialReports') || 'Sales & Financial Reports')}
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {activeTab === 'ice'
              ? (t('iceBillsDesc') || 'Ice blocks procurement expenses & plant payments')
              : activeTab === 'workers'
              ? (t('workerSalariesDesc') || 'Factory peeling labor, daily wages earned & payment accounts')
              : activeTab === 'wastage'
              ? (t('wastageIncomeDesc') || 'Revenue earned from selling prawn head and shell waste')
              : activeTab === 'net'
              ? (t('netProfitDesc') || 'Comprehensive net financial profit: (Sales + Wastage) - (Ice + Labor)')
              : (t('reportsSubtitle') || 'Comprehensive analytics, tax breakdown, and accounting exports')}
          </p>
        </div>

        {/* Global / Tab-Aware Export Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'sales' && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadPDF}
                style={{ fontWeight: 800, padding: '9px 15px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0b5394', boxShadow: '0 2px 8px rgba(11, 83, 148, 0.25)' }}
                title="Download Official Branded PDF Financial Audit Statement"
              >
                <DownloadIcon size={16} color="#ffffff" /> 📄 Export CA Audit PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadGSTPDF}
                style={{ fontWeight: 800, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #0b5394', color: '#0b5394', background: '#f0f7ff' }}
                title="Download Official Government GSTR-1 PDF Statement"
              >
                <FileCheckIcon size={16} /> GSTR-1 PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportGST}
                style={{ fontWeight: 800, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #10b981', color: '#047857', background: '#ecfdf5' }}
                title="Export GSTR-1 Format (B2B, B2C, HSN)"
              >
                <FileCheckIcon size={16} /> GSTR-1 CSV
              </button>
              <button
                type="button"
                className="btn btn-whatsapp"
                onClick={handleShareWhatsApp}
                style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <WhatsAppIcon size={16} color="#ffffff" /> {t('shareWhatsApp')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportCSV}
                style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <DownloadIcon size={16} /> {t('exportExcel')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportTally}
                style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #0b5394', color: '#0b5394' }}
              >
                {t('tallyXml')}
              </button>
            </>
          )}

          {activeTab === 'ice' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportIce}
              style={{ fontWeight: 800, padding: '9px 15px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7' }}
            >
              <DownloadIcon size={16} color="#ffffff" /> {t('exportIceReport') || 'Export Ice CSV'}
            </button>
          )}

          {activeTab === 'workers' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportStaff}
              style={{ fontWeight: 800, padding: '9px 15px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0b5394' }}
            >
              <DownloadIcon size={16} color="#ffffff" /> {t('exportStaffReport') || 'Export Wages CSV'}
            </button>
          )}

          {activeTab === 'wastage' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportWastage}
              style={{ fontWeight: 800, padding: '9px 15px', display: 'flex', alignItems: 'center', gap: '6px', background: '#16a34a' }}
            >
              <DownloadIcon size={16} color="#ffffff" /> {t('exportWastageReport') || 'Export Wastage CSV'}
            </button>
          )}

          {activeTab === 'net' && (
            <button
              type="button"
              className="btn btn-whatsapp"
              onClick={handleShareWhatsApp}
              style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <WhatsAppIcon size={16} color="#ffffff" /> {t('shareWhatsApp')}
            </button>
          )}
        </div>
      </div>

      {/* Multi-Stream View Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sales' ? '3px solid #0b5394' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'sales' ? '#0b5394' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          🧾 {t('salesAndInvoices') || 'Normal Bills (Sales)'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ice')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ice' ? '3px solid #0284c7' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'ice' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          🧊 {t('iceBills') || 'Ice Bills'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workers')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'workers' ? '3px solid #0b5394' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'workers' ? '#0b5394' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          👷 {t('workerSalaries') || 'Worker Salary'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wastage')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wastage' ? '3px solid #16a34a' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'wastage' ? '#16a34a' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          🦐 {t('wastageIncome') || 'Wastage Income'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('net')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'net' ? '3px solid #7c3aed' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'net' ? '#7c3aed' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          ⚖️ {t('netOperationsSummary') || 'Net Operations & Profit'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outstanding')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'outstanding' ? '3px solid #d97706' : '3px solid transparent',
            padding: '8px 16px',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: activeTab === 'outstanding' ? '#d97706' : '#64748b',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          ⚠️ {t('customerOutstanding') || 'Customer Outstanding'}
        </button>
      </div>

      {/* Date Range Selector Bar (for all periodic tabs) */}
      {activeTab !== 'outstanding' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: range === 'custom' ? '12px' : '0' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>
              {lang === 'te' ? 'కాల పరిమితి:' : 'Range:'}
            </span>
            {[
              { id: 'all', label: lang === 'te' ? 'అన్ని తేదీలు' : 'All Dates' },
              { id: 'today', label: t('today') },
              { id: 'yesterday', label: t('yesterday') },
              { id: 'this_week', label: t('thisWeek') },
              { id: 'this_month', label: t('thisMonth') },
              { id: 'last_month', label: t('lastMonth') },
              { id: 'custom', label: t('customDate') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${range === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={range === tab.id ? { background: '#0b5394', color: '#ffffff' } : {}}
                onClick={() => setRange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <form onSubmit={handleApplyCustomDate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
                  {lang === 'te' ? 'ప్రారంభ తేదీ' : 'Start Date'}
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
                  {lang === 'te' ? 'ముగింపు తేదీ' : 'End Date'}
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, padding: '10px 16px' }}>
                {lang === 'te' ? 'వర్తింపజేయి' : 'Apply'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SALES INVOICES (NORMAL BILLS) TAB                                      */}
      {/* ========================================================================= */}
      {activeTab === 'sales' && (
        <>
          {loading ? (
            <div className="spinner" style={{ minHeight: '300px' }}></div>
          ) : report ? (
            <div>
              {/* MoM Engine */}
              {report.monthOverMonth && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                          {lang === 'te' ? 'నెలవారీ అమ్మకాల వృద్ధి విశ్లేషణ' : 'Month-over-Month Performance'}
                        </h3>
                        <span style={{ background: '#eff6ff', color: '#0b5394', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                          MoM Velocity
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Side-by-side growth: <strong>{report.monthOverMonth.thisMonth.name}</strong> vs <strong>{report.monthOverMonth.lastMonth.name}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                    {/* Revenue MoM Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                          {lang === 'te' ? 'మొత్తం టర్నోవర్' : 'Gross Turnover'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: report.monthOverMonth.diff.revenue >= 0 ? '#ecfdf5' : '#fef2f2', color: report.monthOverMonth.diff.revenue >= 0 ? '#047857' : '#b91c1c' }}>
                          {report.monthOverMonth.diff.revenue >= 0 ? '+' : ''}{report.monthOverMonth.diff.revenuePct}%
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', display: 'block' }}>{lang === 'te' ? 'ఈ నెల' : 'This Month'}</span>
                          <span style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0b5394' }}>{formatCurrency(report.monthOverMonth.thisMonth.totalRevenue)}</span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'block' }}>{lang === 'te' ? 'గత నెల' : 'Last Month'}</span>
                          <span style={{ fontSize: '1.02rem', fontWeight: 800, color: '#64748b' }}>{formatCurrency(report.monthOverMonth.lastMonth.totalRevenue)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Volume MoM */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                          {lang === 'te' ? 'ఇన్వాయిస్‌ల సంఖ్య' : 'Invoice Volume'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: report.monthOverMonth.diff.bills >= 0 ? '#ecfdf5' : '#fef2f2', color: report.monthOverMonth.diff.bills >= 0 ? '#047857' : '#b91c1c' }}>
                          {report.monthOverMonth.diff.bills >= 0 ? '+' : ''}{report.monthOverMonth.diff.bills} bills
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', display: 'block' }}>{lang === 'te' ? 'ఈ నెల' : 'This Month'}</span>
                          <span style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0b5394' }}>{report.monthOverMonth.thisMonth.billCount} bills</span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'block' }}>{lang === 'te' ? 'గత నెల' : 'Last Month'}</span>
                          <span style={{ fontSize: '1.02rem', fontWeight: 800, color: '#64748b' }}>{report.monthOverMonth.lastMonth.billCount} bills</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sales KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #0b5394' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('grossRevenue')}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>{formatCurrency(summary.grossRevenue || 0)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{summary.totalBills || 0} {t('invoicesListSubtitle')}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('collectedPaid')}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>{formatCurrency(summary.paidRevenue || 0)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{summary.paidBills || 0} {t('paid')}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('pendingReceivablesTitle')}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>{formatCurrency(summary.pendingRevenue || 0)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{summary.pendingBills || 0} {t('pending')}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('avgTicketSize')}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', marginTop: '6px' }}>{formatCurrency(summary.avgBillValue || 0)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Per bill average</div>
                </div>
              </div>

              {/* GST Breakdown */}
              {summary.taxBreakdown && (
                <div className="card" style={{ padding: '18px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    📊 {t('taxCollectionBreakdown')}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>{t('taxableValue')}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(summary.taxBreakdown.taxableAmount || 0)}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>{t('cgstCollected')}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>{formatCurrency(summary.taxBreakdown.cgst || 0)}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>{t('sgstCollected')}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>{formatCurrency(summary.taxBreakdown.sgst || 0)}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>{t('igstCollected')}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c3aed' }}>{formatCurrency(summary.taxBreakdown.igst || 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bills Listing */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    {t('invoicesForSelectedPeriod')} ({(report.bills || []).length})
                  </h4>
                </div>
                {(report.bills || []).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {t('noInvoicesFound')}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('invoiceNo')}</th>
                          <th>{t('date')}</th>
                          <th>{t('companyName')}</th>
                          <th className="text-right">{t('qtyKg')}</th>
                          <th className="text-right">{t('totalAmount')}</th>
                          <th>{t('status')}</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.bills || []).map((bill) => (
                          <tr key={bill._id}>
                            <td style={{ fontWeight: 800, color: '#0b5394' }}>#{bill.billNo}</td>
                            <td>{formatDate(bill.date)}</td>
                            <td style={{ fontWeight: 700 }}>{bill.companyName}</td>
                            <td className="text-right font-mono">{bill.totalQuantity || bill.quantity || 0} kg</td>
                            <td className="text-right font-mono" style={{ fontWeight: 800 }}>{formatCurrency(bill.grandTotal || bill.total)}</td>
                            <td>
                              <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                                {bill.paymentStatus}
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate(`/bills/${bill._id}`)}
                                style={{ color: '#0b5394', fontWeight: 700 }}
                              >
                                {t('viewInvoiceBtn')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. ICE BILLS & PROCUREMENT TAB                                            */}
      {/* ========================================================================= */}
      {activeTab === 'ice' && (
        <div>
          {loadingIce ? (
            <div className="spinner" style={{ minHeight: '300px' }}></div>
          ) : (
            <div>
              {/* Ice KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం ఐస్ బ్లాకులు' : 'Total Ice Blocks'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>
                    {totalIceBlocks}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {iceData.entries.length} {lang === 'te' ? 'కొనుగోళ్లు' : 'purchases'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం ఐస్ ఖర్చు' : 'Total Ice Cost'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                    {formatCurrency(totalIceCost)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'కూలింగ్ ఖర్చులు' : 'Cooling expenses'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'సగటు రేటు / బ్లాక్' : 'Average Rate / Block'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
                    ₹{avgIceRate}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Per block average</div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'ప్లాంట్ చెల్లింపుల బాకీ' : 'Pending to Plants'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', marginTop: '6px' }}>
                    {formatCurrency(pendingIceToPlants)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'చెల్లించాల్సినది' : 'Unpaid invoices'}
                  </div>
                </div>
              </div>

              {/* Ice Records Table */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    {lang === 'te' ? 'ఐస్ కొనుగోళ్ల జాబితా' : 'Ice Purchase Records'} ({iceData.entries.length})
                  </h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportIce} style={{ fontWeight: 700 }}>
                    <DownloadIcon size={14} /> CSV
                  </button>
                </div>
                {iceData.entries.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {lang === 'te' ? 'ఎంచుకున్న కాలంలో ఎటువంటి ఐస్ కొనుగోళ్లు లేవు.' : 'No ice purchase entries found in this period.'}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('date')}</th>
                          <th>{t('iceFrom') || 'Ice From (Supplier)'}</th>
                          <th>{t('iceTo') || 'Ice To (Receiver)'}</th>
                          <th className="text-right">{t('iceBlocksCount') || 'Blocks'}</th>
                          <th className="text-right">{t('ratePerBlockShort') || 'Rate (₹)'}</th>
                          <th className="text-right">{t('totalAmount')}</th>
                          <th>{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {iceData.entries.map((item) => (
                          <tr key={item._id}>
                            <td>{formatDate(item.date)}</td>
                            <td style={{ fontWeight: 700, color: '#0b5394' }}>{item.iceFrom || item.supplierName || '—'}</td>
                            <td style={{ fontWeight: 600 }}>{item.iceTo || 'Factory / Staff'}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 800 }}>{item.blocks}</td>
                            <td className="text-right font-mono">₹{item.rate}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 900, color: '#ea580c' }}>{formatCurrency(item.totalAmount)}</td>
                            <td>
                              <span className={`badge ${item.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                                {item.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WORKER SALARY & LABOR REPORT TAB                                       */}
      {/* ========================================================================= */}
      {activeTab === 'workers' && (
        <div>
          {loadingStaff ? (
            <div className="spinner" style={{ minHeight: '300px' }}></div>
          ) : (
            <div>
              {/* Workers KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #0b5394' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం కూలీ వేతనాలు' : 'Total Labor Wages'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
                    {formatCurrency(totalWorkerWages)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {staffData.entries.length} {lang === 'te' ? 'పని షిఫ్ట్‌లు' : 'work entries'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'ప్రాసెస్ చేసిన తూకం' : 'Processed Weight'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
                    {totalWorkerKg.toFixed(1)} kg
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'పీలింగ్ పరిమాణం' : 'Peeling production'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'కార్మికుల సంఖ్య' : 'Active Workers'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', marginTop: '6px' }}>
                    {staffData.summary?.staffAccounts?.length || staffData.summary?.overall?.activeWorkers || new Set(staffData.entries.map(e => e.staffName)).size}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Registered team</div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'చెల్లించాల్సిన బాకీ కూలీ' : 'Unpaid Wages Pending'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                    {formatCurrency(totalWorkerPending)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'చెల్లించినది: ' : 'Paid: '}{formatCurrency(totalWorkerPaid)}
                  </div>
                </div>
              </div>

              {/* Workers Account Summary Table */}
              {staffData.summary?.staffAccounts && staffData.summary.staffAccounts.length > 0 && (
                <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      {lang === 'te' ? 'కార్మికుల వారీ కూలీ & బాకీల సారాంశం' : 'Worker-by-Worker Wage Balances'}
                    </h4>
                  </div>
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('workerName')}</th>
                          <th className="text-right">{lang === 'te' ? 'పని దినాలు' : 'Days'}</th>
                          <th className="text-right">{t('qtyKg')}</th>
                          <th className="text-right">{lang === 'te' ? 'మొత్తం సంపాదించినది' : 'Total Earned'}</th>
                          <th className="text-right">{lang === 'te' ? 'చెల్లించినది' : 'Paid'}</th>
                          <th className="text-right">{lang === 'te' ? 'బాకీ బ్యాలెన్స్' : 'Balance Due'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffData.summary.staffAccounts.map((acc, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 800, color: '#0b5394' }}>{acc.staffName}</td>
                            <td className="text-right font-mono">{acc.daysPresent}</td>
                            <td className="text-right font-mono">{acc.totalKg?.toFixed(1)} kg</td>
                            <td className="text-right font-mono" style={{ fontWeight: 800 }}>{formatCurrency(acc.totalEarned)}</td>
                            <td className="text-right font-mono" style={{ color: '#16a34a' }}>{formatCurrency(acc.amountPaid)}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 900, color: acc.pendingBalance > 0 ? '#ea580c' : '#16a34a' }}>
                              {formatCurrency(acc.pendingBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Entries Listing */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    {lang === 'te' ? 'రోజువారీ కూలీ ఎంట్రీలు' : 'Daily Work Entries'} ({staffData.entries.length})
                  </h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportStaff} style={{ fontWeight: 700 }}>
                    <DownloadIcon size={14} /> CSV
                  </button>
                </div>
                {staffData.entries.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {lang === 'te' ? 'ఎంచుకున్న కాలంలో ఎటువంటి కూలీ ఎంట్రీలు లేవు.' : 'No staff labor entries found in this period.'}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('date')}</th>
                          <th>{t('workerName')}</th>
                          <th className="text-right">{t('qtyKg')}</th>
                          <th className="text-right">{t('ratePerKg')}</th>
                          <th className="text-right">{t('totalAmount')}</th>
                          <th>{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffData.entries.map((entry) => (
                          <tr key={entry._id}>
                            <td>{formatDate(entry.date)}</td>
                            <td style={{ fontWeight: 800, color: '#0b5394' }}>{entry.staffName}</td>
                            <td className="text-right font-mono">{entry.quantity} kg</td>
                            <td className="text-right font-mono">₹{entry.price}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 800 }}>{formatCurrency(entry.totalAmount)}</td>
                            <td>
                              <span className={`badge ${entry.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                                {entry.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WASTAGE INCOME (PRAWN HEAD SALES) TAB                                   */}
      {/* ========================================================================= */}
      {activeTab === 'wastage' && (
        <div>
          {loadingWastage ? (
            <div className="spinner" style={{ minHeight: '300px' }}></div>
          ) : (
            <div>
              {/* Wastage KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం వేస్టేజ్ ఆదాయం' : 'Total Wastage Revenue'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
                    {formatCurrency(totalWastageRevenue)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {wastageData.entries.length} {lang === 'te' ? 'అమ్మకాలు' : 'sales shipments'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #0b5394' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'అమ్మిన వేస్టేజ్ తూకం' : 'Total Wastage Sold'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
                    {totalWastageKg.toFixed(1)} kg
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'రొయ్య తలల ఉప-ఉత్పత్తి' : 'Prawn head byproduct'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'సగటు అమ్మకం ధర' : 'Average Selling Rate'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', marginTop: '6px' }}>
                    ₹{avgWastageRate}/kg
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Per KG market recovery</div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'కొనుగోలుదారుల బాకీ' : 'Pending From Buyers'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                    {formatCurrency(pendingWastageReceivables)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {lang === 'te' ? 'వసూలు కావాల్సినది' : 'Receivables'}
                  </div>
                </div>
              </div>

              {/* Wastage Records Table */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    {lang === 'te' ? 'వేస్టేజ్ అమ్మకాల రికార్డులు' : 'Prawn Head Wastage Dispatches'} ({wastageData.entries.length})
                  </h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportWastage} style={{ fontWeight: 700 }}>
                    <DownloadIcon size={14} /> CSV
                  </button>
                </div>
                {wastageData.entries.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {lang === 'te' ? 'ఎంచుకున్న కాలంలో ఎటువంటి వేస్టేజ్ అమ్మకాలు లేవు.' : 'No wastage sales records found in this period.'}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('date')}</th>
                          <th>{lang === 'te' ? 'రకం' : 'Category'}</th>
                          <th>{lang === 'te' ? 'కొనుగోలుదారు' : 'Buyer'}</th>
                          <th className="text-right">{t('qtyKg')}</th>
                          <th className="text-right">{t('ratePerKg')}</th>
                          <th className="text-right">{t('totalAmount')}</th>
                          <th>{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wastageData.entries.map((w) => (
                          <tr key={w._id}>
                            <td>{formatDate(w.date)}</td>
                            <td style={{ fontWeight: 700, color: '#16a34a' }}>{w.category || 'Prawn Head'}</td>
                            <td style={{ fontWeight: 600 }}>{w.buyerName || 'Aqua Feed Plant'}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 800 }}>{w.quantityKg} kg</td>
                            <td className="text-right font-mono">₹{w.rate}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 900, color: '#16a34a' }}>{formatCurrency(w.totalAmount)}</td>
                            <td>
                              <span className={`badge ${w.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                                {w.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. NET OPERATIONS & PROFIT STATEMENT TAB                                   */}
      {/* ========================================================================= */}
      {activeTab === 'net' && (
        <div>
          {/* Master Net Margin Hero Card */}
          <div
            style={{
              background: isNetSurplus ? 'linear-gradient(135deg, #064e3b, #047857)' : 'linear-gradient(135deg, #7c2d12, #c2410c)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '28px 24px',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85 }}>
                  {lang === 'te' ? 'నికర వ్యాపార నిర్వహణ బ్యాలెన్స్' : 'Comprehensive Net Financial Margin'}
                </span>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.02em' }}>
                  {isNetSurplus ? '+' : ''}{formatCurrency(netOperationalMargin)}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.88rem', opacity: 0.9 }}>
                  {isNetSurplus
                    ? (lang === 'te' ? '✓ అమ్మకాలు మరియు వేస్టేజ్ ఆదాయం ఫ్యాక్టరీ ఖర్చులను అధిగమించి లాభంలో ఉంది.' : '✓ Direct revenues (Invoices + Wastage) fully exceed all factory expenses.')
                    : (lang === 'te' ? '⚠️ ఈ కాలంలో ఫ్యాక్టరీ ఖర్చులు ఆదాయం కంటే ఎక్కువగా ఉన్నాయి.' : '⚠️ Factory operational costs exceeded direct period revenue.')}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', padding: '12px 18px', borderRadius: '12px', minWidth: '220px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.85 }}>{t('totalDirectIncome')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#a7f3d0' }}>+{formatCurrency(totalDirectInflow)}</div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '8px 0' }}></div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.85 }}>{t('totalFactoryCost')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fecaca' }}>-{formatCurrency(totalFactoryOutflow)}</div>
              </div>
            </div>
          </div>

          {/* 4-Stream Comparison Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {/* 1. Sales */}
            <div className="stat-card" style={{ borderLeft: '4px solid #0b5394' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'te' ? '1. ఇన్వాయిస్ అమ్మకాలు' : '1. Invoiced Sales'}
                </span>
                <span className="badge badge-blue">Income</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0b5394', marginTop: '6px' }}>
                +{formatCurrency(grossSales)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                {summary.totalBills || 0} bills issued
              </div>
            </div>

            {/* 2. Wastage */}
            <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'te' ? '2. వేస్టేజ్ అమ్మకాలు' : '2. Wastage Sales'}
                </span>
                <span className="badge badge-green">Extra Income</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
                +{formatCurrency(wastageRev)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                {totalWastageKg.toFixed(0)} kg byproduct
              </div>
            </div>

            {/* 3. Ice Cost */}
            <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'te' ? '3. ఐస్ కొనుగోలు' : '3. Ice Expenses'}
                </span>
                <span className="badge badge-amber">Cost</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>
                -{formatCurrency(iceCost)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                {totalIceBlocks} blocks consumed
              </div>
            </div>

            {/* 4. Worker Labor */}
            <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'te' ? '4. కూలీల వేతనాలు' : '4. Worker Labor'}
                </span>
                <span className="badge badge-red">Cost</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                -{formatCurrency(workerWages)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                {totalWorkerKg.toFixed(0)} kg peeled
              </div>
            </div>
          </div>

          {/* Full Itemized 4-Stream Reconciliation Statement */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                {lang === 'te' ? 'ఆర్థిక సంతులన పట్టిక (4 వ్యాపార విభాగాలు)' : 'Financial Stream Reconciliation (4 Core Channels)'}
              </h4>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>{lang === 'te' ? 'విభాగం' : 'Financial Stream'}</th>
                    <th>{lang === 'te' ? 'వివరణ' : 'Description'}</th>
                    <th className="text-right">{lang === 'te' ? 'పరిమాణం' : 'Volume / Count'}</th>
                    <th className="text-right">{lang === 'te' ? 'మొత్తం ప్రభావం (₹)' : 'Net Impact (₹)'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ fontWeight: 800, color: '#16a34a' }}>(+) Normal Invoiced Sales</td>
                    <td style={{ color: '#475569' }}>Customer seafood supply invoices & GST billings</td>
                    <td className="text-right font-mono">{summary.totalBills || 0} bills</td>
                    <td className="text-right font-mono" style={{ fontWeight: 900, color: '#16a34a' }}>+{formatCurrency(grossSales)}</td>
                  </tr>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ fontWeight: 800, color: '#16a34a' }}>(+) Prawn Head Wastage Revenue</td>
                    <td style={{ color: '#475569' }}>Feed plant byproduct sales & shell waste recoveries</td>
                    <td className="text-right font-mono">{totalWastageKg.toFixed(1)} kg</td>
                    <td className="text-right font-mono" style={{ fontWeight: 900, color: '#16a34a' }}>+{formatCurrency(wastageRev)}</td>
                  </tr>
                  <tr style={{ background: '#fff7ed' }}>
                    <td style={{ fontWeight: 800, color: '#ea580c' }}>(-) Worker Peeling Labor Wages</td>
                    <td style={{ color: '#475569' }}>Daily labor attendance wages (weight * piece rate)</td>
                    <td className="text-right font-mono">{totalWorkerKg.toFixed(1)} kg</td>
                    <td className="text-right font-mono" style={{ fontWeight: 900, color: '#dc2626' }}>-{formatCurrency(workerWages)}</td>
                  </tr>
                  <tr style={{ background: '#f0f9ff' }}>
                    <td style={{ fontWeight: 800, color: '#0284c7' }}>(-) Ice Blocks Procurement</td>
                    <td style={{ color: '#475569' }}>Factory preservation ice blocks supplied by ice plants</td>
                    <td className="text-right font-mono">{totalIceBlocks} blocks</td>
                    <td className="text-right font-mono" style={{ fontWeight: 900, color: '#dc2626' }}>-{formatCurrency(iceCost)}</td>
                  </tr>
                  <tr style={{ background: isNetSurplus ? '#ecfdf5' : '#fef2f2', borderTop: '2px solid #0f172a' }}>
                    <td colSpan={3} style={{ fontWeight: 900, fontSize: '1.05rem', color: isNetSurplus ? '#047857' : '#991b1b' }}>
                      {lang === 'te' ? 'నికర వ్యాపార లాభం / మిగులు' : 'TOTAL NET OPERATIONAL PROFIT / (LOSS)'}
                    </td>
                    <td className="text-right font-mono" style={{ fontWeight: 900, fontSize: '1.25rem', color: isNetSurplus ? '#047857' : '#991b1b' }}>
                      {isNetSurplus ? '+' : ''}{formatCurrency(netOperationalMargin)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CUSTOMER OUTSTANDING BALANCES TAB                                      */}
      {/* ========================================================================= */}
      {activeTab === 'outstanding' && (
        <div>
          {loadingOutstanding ? (
            <div className="spinner" style={{ minHeight: '300px' }}></div>
          ) : outstandingData ? (
            <div>
              {/* Outstanding Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #ea580c' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం రావలసిన బాకీ' : 'Total Outstanding Receivables'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                    {formatCurrency(outstandingData.summary?.totalOutstandingBalance || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {outstandingData.summary?.customersWithBalance || 0} {lang === 'te' ? 'ఖాతాదారుల వద్ద బాకీ' : 'customers with dues'}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'మొత్తం బాకీ ఉన్న బిల్లులు' : 'Total Unpaid Invoices'}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', marginTop: '6px' }}>
                    {outstandingData.summary?.totalUnpaidBills || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Pending payment settlement</div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'te' ? 'అత్యధిక బాకీ ఖాతాదారు' : 'Top Customer Exposure'}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#7c3aed', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {filteredOutstanding[0]?.companyName || 'None'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {filteredOutstanding[0] ? formatCurrency(filteredOutstanding[0].outstandingBalance) : '₹0'}
                  </div>
                </div>
              </div>

              {/* Outstanding Table */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    {lang === 'te' ? 'ఖాతాదారుల బాకీల జాబితా' : 'Customer Ledger Outstanding Balances'} ({filteredOutstanding.length})
                  </h4>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={lang === 'te' ? 'కస్టమర్ పేరు లేదా ఫోన్ వెతకండి...' : 'Search customer or phone...'}
                    value={outstandingSearch}
                    onChange={(e) => setOutstandingSearch(e.target.value)}
                    style={{ maxWidth: '280px', height: '36px', fontSize: '0.84rem' }}
                  />
                </div>
                {filteredOutstanding.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {lang === 'te' ? 'ఎటువంటి బాకీలు లేవు.' : 'No customer outstanding balances found.'}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('companyName')}</th>
                          <th>Phone</th>
                          <th className="text-right">{lang === 'te' ? 'రావలసిన బాకీ (₹)' : 'Balance (₹)'}</th>
                          <th className="text-right">{lang === 'te' ? 'బాకీ బిల్లులు' : 'Unpaid Bills'}</th>
                          <th>{lang === 'te' ? 'చివరి బిల్లు తేదీ' : 'Last Bill'}</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOutstanding.map((c, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 800, color: '#0b5394' }}>{c.companyName}</td>
                            <td>{c.customerPhone || '—'}</td>
                            <td className="text-right font-mono" style={{ fontWeight: 900, color: '#ea580c' }}>
                              {formatCurrency(c.outstandingBalance)}
                            </td>
                            <td className="text-right font-mono">
                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                                {c.unpaidBillsCount} unpaid
                              </span>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{c.lastBillDate ? formatDate(c.lastBillDate) : '—'}</td>
                            <td className="text-right">
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-whatsapp btn-sm"
                                  onClick={() => handleSendWhatsAppReminder(c)}
                                  style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="Send WhatsApp Payment Reminder"
                                >
                                  <WhatsAppIcon size={14} color="#ffffff" /> Reminder
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCopyReminder(c)}
                                  style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700 }}
                                  title="Copy Reminder Text"
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => navigate(`/bills?search=${encodeURIComponent(c.companyName)}`)}
                                  style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, color: '#0b5394' }}
                                >
                                  Bills
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast, shareInvoicePDFOnWhatsApp } from '../utils/helpers';
import { SearchIcon, PrintIcon, DownloadIcon, WhatsAppIcon, DownloadIcon as ExportIcon, PlusIcon, ShareIcon, InvoiceIcon, TrashIcon } from '../components/Icons';
import { SkeletonTable } from '../components/Skeleton';
import ReminderModal from '../components/ReminderModal';
import PaymentModal from '../components/PaymentModal';
import PullToRefresh from '../components/PullToRefresh';
import DeleteInvoiceModal from '../components/DeleteInvoiceModal';
import { getAllOfflineBills, getMasterCache, setMasterCache, getUserCacheKey, invalidateBillCaches } from '../utils/offlineDb';

const MAX_SCROLL_ITEMS = 60; // Cap continuous scroll list to protect mobile memory

export default function BillHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast, showToast } = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayMode, setDisplayMode] = useState('scroll'); // 'scroll' | 'pages'
  const [viewFormat, setViewFormat] = useState('cards'); // 'cards' | 'table'
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [exporting, setExporting] = useState(false);
  const [reminderBillId, setReminderBillId] = useState(null);
  const [paymentBillId, setPaymentBillId] = useState(null);
  const [shareBill, setShareBill] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [deleteBillTarget, setDeleteBillTarget] = useState(null);
  const [deletingBill, setDeletingBill] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canDeleteBill = user?.role === 'admin' || user?.role === 'owner';
  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'owner' || user?.role === 'admin';

  // Compute total quantity from items array, with fallback to bill.quantity
  const getTotalQuantity = (bill) => {
    if (bill.items && bill.items.length > 0) {
      const total = bill.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
      if (total > 0) return total;
    }
    return bill.quantity || 0;
  };

  useEffect(() => {
    loadBills();
    const handleSync = () => loadBills();
    const handleInvalidate = () => loadBills(true);
    window.addEventListener('vda-sync-completed', handleSync);
    window.addEventListener('vda-cache-invalidated', handleInvalidate);
    return () => {
      window.removeEventListener('vda-sync-completed', handleSync);
      window.removeEventListener('vda-cache-invalidated', handleInvalidate);
    };
  }, [page, statusFilter]);

  const loadBills = async (resetPage = false) => {
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    const hasFilters = Boolean(search.trim() || dateFrom || dateTo || statusFilter);

    // 1. Instant Cache-First render for default Page 1 (keyed by user id & role)
    if (currentPage === 1 && !hasFilters) {
      try {
        const historyKey = getUserCacheKey('historyPage1', user);
        const cached = await getMasterCache(historyKey);
        if (cached && Array.isArray(cached.bills) && cached.bills.length > 0) {
          setBills(cached.bills);
          if (cached.pagination) setPagination(cached.pagination);
          setLoading(false);
          setIsUpdating(true);
        }
      } catch (e) {
        // Fall back to normal loading
      }
    }

    setBills((current) => {
      if (!current || current.length === 0) {
        setLoading(true);
      } else {
        setIsUpdating(true);
      }
      return current;
    });

    try {
      const params = { page: currentPage, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter) params.status = statusFilter;

      // Retrieve any pending offline bills from local IndexedDB
      const offlineBills = await getAllOfflineBills().catch(() => []);
      const pendingOffline = offlineBills.filter((b) => b.isOffline && !b.synced);

      const response = await billsAPI.list(params);
      const serverBills = response.data.bills || [];

      // Prepend pending offline invoices at the top of first page
      let finalBills = serverBills;
      if (currentPage === 1 && pendingOffline.length > 0) {
        finalBills = [...pendingOffline, ...serverBills];
      }
      setBills(finalBills);
      const paginationData = response.data.pagination || {};
      setPagination(paginationData);

      // Cache page 1 snapshot for subsequent instant visits (keyed by user id & role)
      if (currentPage === 1 && !hasFilters) {
        setMasterCache(getUserCacheKey('historyPage1', user), {
          bills: finalBills,
          pagination: paginationData,
        }).catch(() => {});
      }
    } catch (error) {
      // Offline fallback: window and paginate cached bills from local IndexedDB
      try {
        const offlineBills = await getAllOfflineBills().catch(() => []);
        if (offlineBills.length > 0) {
          const pageSize = 15;
          const totalPages = Math.ceil(offlineBills.length / pageSize);
          const startIndex = (currentPage - 1) * pageSize;
          const pagedSlice = offlineBills.slice(startIndex, startIndex + pageSize);
          setBills(pagedSlice);
          setPagination({ total: offlineBills.length, pages: totalPages, page: currentPage });
        }
      } catch (e) {}
      if (import.meta.env.DEV) { console.error('Failed to load invoices:', error); }
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || page >= (pagination.pages || 1)) return;
    if (bills.length >= MAX_SCROLL_ITEMS) {
      setDisplayMode('pages');
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = { page: nextPage, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter) params.status = statusFilter;

      const response = await billsAPI.list(params);
      const newBills = response.data.bills || [];
      setBills((prev) => [...prev, ...newBills]);
      setPage(nextPage);
      setPagination(response.data.pagination || {});
    } catch (error) {
      showToast('Failed to load more invoices', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadBills(true);
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setPage(1);
    setTimeout(() => loadBills(true), 0);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = { limit: -1, all: 'true' };
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter) params.status = statusFilter;

      const response = await billsAPI.list(params);
      const allBills = response.data.bills || [];

      if (allBills.length === 0) {
        showToast('No invoices found to export', 'error');
        return;
      }

      const filename = `VDA_GST_Invoices_${dateFrom || 'All'}_to_${dateTo || 'Today'}.csv`;
      exportBillsToCSV(allBills, filename);
      showToast(`Exported ${allBills.length} invoices for GST & CA filing`);
    } catch (error) {
      showToast('Failed to export invoices', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = (e, id) => {
    e.stopPropagation();
    navigate(`/bills/${id}?autoprint=true`);
  };

  const handleDownloadPDF = async (e, id, billNo) => {
    e.stopPropagation();
    if (downloadingPdfId) return;
    setDownloadingPdfId(id);
    showToast(`Generating PDF invoice...`, 'info');
    try {
      const response = await billsAPI.getPDFBlob(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${billNo || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`PDF downloaded successfully`, 'success');
    } catch (error) {
      if (import.meta.env.DEV) { console.error('Download error:', error); }
      showToast('Failed to download PDF', 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleShareWhatsApp = async (e, bill) => {
    e.stopPropagation();
    try {
      await shareInvoicePDFOnWhatsApp(bill, showToast);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('WhatsApp share error:', err); }
    }
  };

  const handleDeleteBill = async ({ confirmationCode, reason }) => {
    if (!deleteBillTarget) return;
    setDeletingBill(true);
    try {
      const res = await billsAPI.delete(deleteBillTarget._id, confirmationCode, reason);
      const targetNo = deleteBillTarget.billNo || deleteBillTarget.originalBillNo;
      showToast(
        res.data?.message ||
          `Invoice #${targetNo} deleted successfully. Next invoice will be #${res.data?.nextInvoiceNo || targetNo}.`,
        'success'
      );
      // Remove from active list immediately
      setBills((prev) => prev.filter((b) => b._id !== deleteBillTarget._id));
      setPagination((prev) => ({ ...prev, total: Math.max(0, (prev.total || 1) - 1) }));
      setDeleteBillTarget(null);
      invalidateBillCaches('delete').catch(() => {});
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete invoice', 'error');
    } finally {
      setDeletingBill(false);
    }
  };



  return (
    <PullToRefresh onRefresh={() => loadBills(1)}>
      <div className="page-container fade-in">
        <Toast toast={toast} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0 }}>Invoice History</h1>
            {isUpdating && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#0b5394',
                  background: '#e0f2fe',
                  padding: '3px 9px',
                  borderRadius: '12px',
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#0284c7',
                    display: 'inline-block',
                  }}
                />
                Updating...
              </span>
            )}
          </div>
          <p>View, print, download, share or export invoices for GST & CA filing</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => billsAPI.exportCSV({ search, dateFrom, dateTo, paymentStatus: statusFilter })}
                title="Export all filtered bills to CSV for GST / CA accounting"
                style={{ fontWeight: 600 }}
              >
                <ExportIcon size={16} /> Export Excel (CSV)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => billsAPI.exportTally({ dateFrom, dateTo })}
                title="Export sales vouchers in standard Tally Prime XML"
                style={{ fontWeight: 700, border: '1.5px solid #0b5394', color: '#0b5394' }}
              >
                Tally XML
              </button>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/reports')}
                style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700 }}
              >
                Sales Reports
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <form className="invoice-filter-card" onSubmit={handleSearch}>
        {/* Mobile Filter Header & Search Bar */}
        <div className="filter-search-mobile-bar" style={{ display: 'none' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search customer or invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: '44px', paddingRight: '40px', borderRadius: '10px' }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearch(''); setTimeout(() => loadBills(true), 0); }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#52606d', fontSize: '1rem', cursor: 'pointer', padding: '4px', minWidth: '40px', minHeight: '40px' }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary filter-toggle-btn"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: (dateFrom || dateTo || statusFilter) ? '1.5px solid #0b5394' : '1.5px solid #cbd5e1',
              background: (dateFrom || dateTo || statusFilter) ? '#eff6ff' : '#f8fafc',
              color: (dateFrom || dateTo || statusFilter) ? '#0b5394' : '#475569',
              whiteSpace: 'nowrap',
            }}
          >
            <span>⚙️ Filters</span>
            {(dateFrom || dateTo || statusFilter) && (
              <span style={{ background: '#0b5394', color: '#fff', fontSize: '0.68rem', borderRadius: '999px', padding: '1px 6px', fontWeight: 800 }}>
                {Boolean(dateFrom) + Boolean(dateTo) + Boolean(statusFilter)}
              </span>
            )}
            <span style={{ fontSize: '0.72rem' }}>{showMobileFilters ? '▲' : '▼'}</span>
          </button>
        </div>

        <div className={`invoice-filter-grid ${showMobileFilters ? 'mobile-filters-expanded' : ''}`}>
          <div className="filter-group filter-search-group">
            <label className="filter-label">Search Customer / Invoice #</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group filter-date-from-group">
            <label className="filter-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="filter-group filter-date-to-group">
            <label className="filter-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="filter-group filter-status-group">
            <label className="filter-label">Payment Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid Only</option>
              <option value="Pending">Pending Only</option>
            </select>
          </div>

          <div className="filter-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: '#0b5394',
                color: '#ffffff',
                border: '1px solid #0b5394',
                fontWeight: 700,
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <SearchIcon size={16} color="#ffffff" /> Search
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0 14px', color: '#64748b', height: '42px', borderRadius: '8px', whiteSpace: 'nowrap' }}
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      {/* Bills Table */}
      <div className="card">
        {loading ? (
          <SkeletonTable rows={8} cols={6} hasHeader={false} />
        ) : bills.length > 0 ? (
          <>
            {/* Mobile Cards View (Hidden on Desktop/Laptop, Visible on Phones) */}
            <div className="mobile-bills-list">
              {bills.map((bill) => {
                const totalQty = getTotalQuantity(bill);
                return (
                    <div
                      key={bill._id}
                      className="mobile-bill-card"
                      style={bill.isVoided ? { background: '#fef2f2', border: '1px dashed #fca5a5', opacity: 0.85 } : {}}
                      onClick={() => navigate(`/bills/${bill._id}`)}
                    >
                      {/* Top Row: Bill # + Date + Status */}
                      <div className="mobile-bill-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-blue tabular-num" style={{ fontSize: '0.8rem', padding: '3px 8px', fontWeight: 700 }}>#{bill.billNo}</span>
                          {bill.isVoided && (
                            <span className="badge" style={{ background: '#fee2e2', color: '#b42318', fontWeight: 700, fontSize: '0.72rem' }}>
                              VOIDED
                            </span>
                          )}
                          {bill.isOffline && (
                            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.72rem' }}>
                              Offline
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#52606d', fontWeight: 500 }}>{formatDate(bill.date)}</span>
                          {!bill.isVoided && (
                            <span
                              className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              {bill.paymentStatus || 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Body: Company + Weight + Amount */}
                      <div className="mobile-bill-body">
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: bill.isVoided ? '#991b1b' : 'var(--text-primary)',
                          textDecoration: bill.isVoided ? 'line-through' : 'none',
                          marginBottom: '8px',
                          lineHeight: 1.3,
                        }}>
                          {bill.companyName}
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          padding: '8px 10px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#52606d', fontWeight: 600 }}>Weight:</span>
                            <span className="tabular-num" style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalQty} kg</span>
                          </div>
                          {canSeeSales && (
                            <span className="tabular-num" style={{
                              fontSize: '1.1rem',
                              fontWeight: 700,
                              color: bill.isVoided ? '#b42318' : '#0b5394',
                              textDecoration: bill.isVoided ? 'line-through' : 'none',
                            }}>
                              {formatCurrency(bill.grandTotal || bill.total)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer: compact explicit actions with >= 48px tap targets */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', marginTop: '10px', flexWrap: 'wrap' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!bill.isVoided && !bill.isOffline && canUpdateStatus && bill.paymentStatus !== 'Paid' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={(e) => { e.stopPropagation(); setPaymentBillId(bill._id); }}
                              style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #a7f3d0', fontWeight: 600, minHeight: '48px', padding: '0 12px', borderRadius: '10px' }}
                            >
                              Pay
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={(e) => { e.stopPropagation(); setReminderBillId(bill._id); }}
                              style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600, minHeight: '48px', padding: '0 12px', borderRadius: '10px' }}
                            >
                              Remind
                            </button>
                          </>
                        )}
                        {!bill.isVoided && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(e, bill); }}
                            style={{ background: '#25D366', border: 'none', borderRadius: '10px', minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: '10px' }}
                            title="Share on WhatsApp"
                            aria-label={`Share invoice #${bill.billNo} on WhatsApp`}
                          >
                            <WhatsAppIcon size={20} color="#ffffff" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handlePrint(e, bill._id); }}
                          style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: '10px' }}
                          title="Print Invoice"
                          aria-label={`Print invoice #${bill.billNo}`}
                        >
                          <PrintIcon size={18} color="#0b5394" />
                        </button>
                        {canDeleteBill && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteBillTarget(bill); }}
                            style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: '10px' }}
                            title="Delete Invoice"
                            aria-label={`Delete invoice #${bill.billNo}`}
                          >
                            <TrashIcon size={18} color="#b42318" />
                          </button>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>

            {/* Desktop / Laptop Table View (Hidden on Phones, Native Table on Laptop) */}
            <div className="table-container desktop-only-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Company Name</th>
                    <th>Invoice Date</th>
                    <th className="text-right">Quantity (KG)</th>
                    <th>Payment Status</th>
                    {canSeeSales && <th className="text-right">Total Amount</th>}
                    <th className="text-center" style={{ width: '200px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill._id} style={bill.isVoided ? { background: '#fef2f2', opacity: 0.85 } : {}}>
                      <td>
                        <span className="badge badge-blue">#{bill.billNo}</span>
                        {bill.isVoided && (
                          <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800, marginLeft: '6px' }}>
                            VOIDED
                          </span>
                        )}
                        {bill.isOffline && (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, marginLeft: '6px', fontSize: '0.72rem' }}>
                            Offline
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: bill.isVoided ? '#991b1b' : 'var(--accent-primary)',
                            cursor: 'pointer',
                            textDecoration: bill.isVoided ? 'line-through' : 'none',
                          }}
                          onClick={() => navigate(`/bills/${bill._id}`)}
                          title="Click to view invoice details"
                        >
                          {bill.companyName}
                        </span>
                      </td>
                      <td>{formatDate(bill.date)}</td>
                      <td className="text-right">{getTotalQuantity(bill)} kg</td>
                      <td>
                        {bill.isVoided ? (
                          <span className="badge" style={{ background: '#fecaca', color: '#991b1b', fontWeight: 700 }}>
                            Voided
                          </span>
                        ) : (
                          <span
                            className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                          >
                            {bill.paymentStatus || 'Pending'}
                          </span>
                        )}
                      </td>
                      {canSeeSales && (
                        <td className="text-right" style={{
                          fontWeight: 700,
                          color: bill.isVoided ? '#dc2626' : 'var(--text-primary)',
                          textDecoration: bill.isVoided ? 'line-through' : 'none',
                        }}>
                          {formatCurrency(bill.grandTotal || bill.total)}
                        </td>
                      )}
                      <td className="text-center">
                        <div className="action-buttons" style={{ justifyContent: 'center', display: 'flex', gap: '6px' }}>
                          {!bill.isVoided && !bill.isOffline && canUpdateStatus && bill.paymentStatus !== 'Paid' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPaymentBillId(bill._id)}
                                title="Record Payment"
                                style={{ background: '#ecfdf5', color: '#166534', borderColor: '#a7f3d0', fontWeight: 600, padding: '6px 10px' }}
                              >
                                Pay
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setReminderBillId(bill._id)}
                                title="Send Payment Reminder"
                                style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a', fontWeight: 600, padding: '6px 10px' }}
                              >
                                Remind
                              </button>
                            </>
                          )}
                          {!bill.isVoided && (
                            <button
                              type="button"
                              className="btn btn-whatsapp btn-sm"
                              onClick={(e) => handleShareWhatsApp(e, bill)}
                              title="Share on WhatsApp"
                              aria-label={`Share invoice #${bill.billNo} on WhatsApp`}
                              style={{ padding: '6px 10px' }}
                            >
                              <WhatsAppIcon size={14} color="#ffffff" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handlePrint(e, bill._id)}
                            title="Print Invoice"
                            aria-label={`Print invoice #${bill.billNo}`}
                            style={{ padding: '6px 10px' }}
                          >
                            <PrintIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handleDownloadPDF(e, bill._id, bill.formattedBillNo || bill.billNumber || bill.billNo)}
                            disabled={downloadingPdfId === bill._id}
                            title="Download PDF"
                            aria-label={`Download PDF for invoice #${bill.billNo}`}
                            style={{ padding: '6px 10px' }}
                          >
                            {downloadingPdfId === bill._id ? (
                              <span className="btn-spinner" style={{ width: '12px', height: '12px' }}></span>
                            ) : (
                              <DownloadIcon size={14} />
                            )}
                          </button>
                          {canDeleteBill && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5', fontWeight: 700, padding: '6px 10px' }}
                              onClick={() => setDeleteBillTarget(bill)}
                              title="Delete Invoice"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination & Infinite Load More Controls */}
            <div style={{ marginTop: '20px', padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', borderRadius: '0 0 12px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                  {t('showingBills')
                    .replace('{count}', bills.length)
                    .replace('{total}', pagination.total || bills.length)}
                </span>

                {/* View Mode Toggle: Load More vs Pages */}
                {pagination.pages > 1 && (
                  <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('scroll')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        background: displayMode === 'scroll' ? '#ffffff' : 'transparent',
                        color: displayMode === 'scroll' ? '#0b5394' : '#64748b',
                        boxShadow: displayMode === 'scroll' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {t('loadMore') || 'Load More'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('pages')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        background: displayMode === 'pages' ? '#ffffff' : 'transparent',
                        color: displayMode === 'pages' ? '#0b5394' : '#64748b',
                        boxShadow: displayMode === 'pages' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Pages
                    </button>
                  </div>
                )}
              </div>

              {/* In Scroll / Load More Mode */}
              {displayMode === 'scroll' ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {bills.length >= MAX_SCROLL_ITEMS && bills.length < (pagination.total || 0) ? (
                    <div
                      style={{
                        maxWidth: '460px',
                        margin: '0 auto',
                        padding: '16px 20px',
                        background: '#eff6ff',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: '12px',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#1e40af', fontWeight: 600 }}>
                        📱 <strong>{bills.length} invoices loaded.</strong> To keep scrolling smooth on mobile devices, switch to <strong>Pages</strong> mode to browse remaining invoices.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setDisplayMode('pages')}
                        style={{ minHeight: '44px', width: '100%', fontSize: '0.88rem', fontWeight: 800 }}
                      >
                        Switch to Pages Mode ({((pagination.total || 0) - bills.length)} older)
                      </button>
                    </div>
                  ) : bills.length < (pagination.total || 0) ? (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        maxWidth: '360px',
                        padding: '11px 20px',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        borderRadius: '10px',
                        background: '#0b5394',
                        boxShadow: '0 4px 12px rgba(11, 83, 148, 0.15)',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {loadingMore ? (
                        <>
                          <span className="btn-spinner"></span>
                          Loading invoices...
                        </>
                      ) : (
                        `↓ ${t('loadMore')} (${(pagination.total || 0) - bills.length} remaining)`
                      )}
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        margin: '6px 0',
                      }}
                    >
                      <span style={{ color: '#0b5394' }}>✓</span>
                      <span>
                        {t('allLoaded') || 'All invoices loaded'} ({pagination.total || bills.length} total)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Paginated View */
                pagination.pages > 1 && (
                  <div className="pagination" style={{ margin: 0 }}>
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Prev
                    </button>
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                      .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pagination.pages)
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <span key={p}>
                            {showEllipsis && <span className="pagination-ellipsis">...</span>}
                            <button
                              className={page === p ? 'active' : ''}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          </span>
                        );
                      })}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.pages}
                    >
                      Next
                    </button>
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}>📋</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {t?.noInvoicesFound || 'No invoices found'}
            </p>
            {(search || dateFrom || dateTo || statusFilter) && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {t?.tryAdjustingFilters || 'Try adjusting your search or filters'}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(search || dateFrom || dateTo || statusFilter) && (
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: '44px', padding: '10px 20px', fontSize: '0.9rem' }}
                  onClick={() => {
                    setSearch('');
                    setDateFrom('');
                    setDateTo('');
                    setStatusFilter('');
                    setPage(1);
                    setTimeout(() => loadBills(true), 0);
                  }}
                >
                  {t?.clearFilters || 'Clear Filters'}
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ minHeight: '44px', padding: '10px 20px', fontSize: '0.9rem' }}
                onClick={() => navigate('/new-bill')}
              >
                {t?.newInvoice || '+ New Invoice'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Payment Reminder Modal */}
      {reminderBillId && (
        <ReminderModal
          billId={reminderBillId}
          onClose={() => setReminderBillId(null)}
        />
      )}

      {/* Record Payment Modal */}
      {paymentBillId && (
        <PaymentModal
          billId={paymentBillId}
          onClose={() => setPaymentBillId(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadBills();
          }}
        />
      )}

      {/* Delete Invoice Modal (Admin Only) */}
      <DeleteInvoiceModal
        isOpen={Boolean(deleteBillTarget)}
        bill={deleteBillTarget}
        loading={deletingBill}
        onClose={() => setDeleteBillTarget(null)}
        onConfirm={handleDeleteBill}
      />
      </div>
    </PullToRefresh>
  );
}

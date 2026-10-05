import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast, shareInvoicePDFOnWhatsApp } from '../utils/helpers';
import { SearchIcon, PrintIcon, DownloadIcon, WhatsAppIcon, DownloadIcon as ExportIcon, PlusIcon, ShareIcon, InvoiceIcon } from '../components/Icons';
import { SkeletonTable } from '../components/Skeleton';
import ReminderModal from '../components/ReminderModal';
import PaymentModal from '../components/PaymentModal';
import SwipeableItem from '../components/SwipeableItem';
import PullToRefresh from '../components/PullToRefresh';
import { getAllOfflineBills } from '../utils/offlineDb';

export default function BillHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast, showToast } = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayMode, setDisplayMode] = useState('scroll'); // 'scroll' | 'pages'
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [exporting, setExporting] = useState(false);
  const [reminderBillId, setReminderBillId] = useState(null);
  const [paymentBillId, setPaymentBillId] = useState(null);
  const [shareBill, setShareBill] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  const isAdmin = user?.role === 'admin';
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
    window.addEventListener('vda-sync-completed', handleSync);
    return () => window.removeEventListener('vda-sync-completed', handleSync);
  }, [page, statusFilter]);

  const loadBills = async (resetPage = false) => {
    setLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);

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
      if (currentPage === 1 && pendingOffline.length > 0) {
        setBills([...pendingOffline, ...serverBills]);
      } else {
        setBills(serverBills);
      }
      setPagination(response.data.pagination || {});
    } catch (error) {
      // Offline fallback: load cached bills from local IndexedDB
      try {
        const offlineBills = await getAllOfflineBills().catch(() => []);
        if (offlineBills.length > 0) {
          setBills(offlineBills);
          setPagination({ total: offlineBills.length, pages: 1 });
        }
      } catch (e) {}
      if (import.meta.env.DEV) { console.error('Failed to load invoices:', error); }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || page >= (pagination.pages || 1)) return;
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
      const pdfUrl = billsAPI.getPDF(id);
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${billNo || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`PDF downloaded successfully!`, 'success');
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



  return (
    <PullToRefresh onRefresh={() => loadBills(1)}>
      <div className="page-container fade-in">
        <Toast toast={toast} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Invoice History</h2>
          <p>View, print, download, share or export invoices for GST & CA filing</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => window.open(billsAPI.exportCSVUrl({ search, dateFrom, dateTo, paymentStatus }), '_blank')}
                title="Export all filtered bills to CSV for GST / CA accounting"
                style={{ fontWeight: 700 }}
              >
                <ExportIcon size={16} /> Export Excel (CSV)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.open(billsAPI.exportTallyUrl({ dateFrom, dateTo }), '_blank')}
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
        <div className="invoice-filter-grid">
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
            {/* Mobile Cards View (Visible on Phones & Tablets) */}
            <div className="mobile-bills-list">
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', padding: '0 4px 6px 0', fontWeight: 600 }}>
                👈 Swipe card left for quick actions
              </div>
              {bills.map((bill) => {
                const totalQty = getTotalQuantity(bill);
                return (
                  <SwipeableItem
                    key={bill._id}
                    actions={[
                      ...(!bill.isVoided
                        ? [
                            {
                              label: 'WhatsApp',
                              icon: <WhatsAppIcon size={16} color="#ffffff" />,
                              background: '#25D366',
                              onClick: () => handleShareWhatsApp(null, bill),
                            },
                          ]
                        : []),
                      {
                        label: 'Print',
                        icon: <PrintIcon size={16} color="#ffffff" />,
                        background: '#0b5394',
                        onClick: () => handlePrint(null, bill._id),
                      },
                      {
                        label: 'View',
                        icon: <InvoiceIcon size={16} color="#ffffff" />,
                        background: '#4f46e5',
                        onClick: () => navigate(`/bills/${bill._id}`),
                      },
                    ]}
                  >
                    <div className="mobile-bill-card" style={bill.isVoided ? { background: '#fef2f2', border: '1px dashed #fca5a5', opacity: 0.85 } : {}}>
                      {/* Top Row: Bill # + Date + Status */}
                      <div className="mobile-bill-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '3px 8px', fontWeight: 800 }}>#{bill.billNo}</span>
                      {bill.isVoided && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: '0.72rem' }}>
                          VOIDED
                        </span>
                      )}
                      {bill.isOffline && (
                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.72rem' }}>
                          ⚡ Shed Offline
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>{formatDate(bill.date)}</span>
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
                  <div className="mobile-bill-body" onClick={() => navigate(`/bills/${bill._id}`)}>
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
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Weight:</span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalQty} kg</span>
                      </div>
                      {canSeeSales && (
                        <span style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          color: bill.isVoided ? '#dc2626' : '#0b5394',
                          textDecoration: bill.isVoided ? 'line-through' : 'none',
                        }}>
                          {formatCurrency(bill.grandTotal || bill.total)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mobile-bill-actions">
                    <button
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '9px 6px',
                        fontSize: '0.82rem',
                        background: '#f8fafc',
                        border: '1.5px solid #0b5394',
                        color: '#0b5394',
                        fontWeight: 700,
                        borderRadius: '8px',
                      }}
                      onClick={(e) => handlePrint(e, bill._id)}
                      title="Print Invoice"
                    >
                      <PrintIcon size={14} color="#0b5394" /> Print
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '9px 6px',
                        fontSize: '0.82rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontWeight: 700,
                        borderRadius: '8px',
                      }}
                      onClick={(e) => handleDownloadPDF(e, bill._id, bill.formattedBillNo || bill.billNumber || bill.billNo)}
                      disabled={downloadingPdfId === bill._id}
                    >
                      {downloadingPdfId === bill._id ? (
                        <>
                          <span className="btn-spinner"></span> PDF...
                        </>
                      ) : (
                        <>
                          <DownloadIcon size={14} color="#334155" /> PDF
                        </>
                      )}
                    </button>
                    {!bill.isVoided && (
                      <button
                        className="btn btn-whatsapp btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 6px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px' }}
                        onClick={(e) => handleShareWhatsApp(e, bill)}
                      >
                        <WhatsAppIcon size={15} color="#ffffff" /> Share
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontWeight: 600,
                        borderRadius: '8px',
                      }}
                      onClick={() => navigate(`/bills/${bill._id}`)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </SwipeableItem>
              )})}
            </div>

            {/* Desktop Table View (Visible on Laptop & Desktop) */}
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
                    <th className="text-center" style={{ width: '230px' }}>Actions</th>
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
                            ⚡ Shed Offline
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: bill.isVoided ? '#991b1b' : 'var(--accent-primary)',
                            cursor: 'pointer',
                            textDecoration: bill.isVoided ? 'line-through' : 'underline',
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
                        <div className="action-buttons" style={{ justifyContent: 'center' }}>
                          {!bill.isVoided && (
                            <button
                              className="btn btn-whatsapp btn-sm"
                              onClick={(e) => handleShareWhatsApp(e, bill)}
                              title="Share on WhatsApp"
                            >
                              <WhatsAppIcon size={14} color="#ffffff" /> Share
                            </button>
                          )}

                          {/* Admin Only: WhatsApp & SMS Payment Reminder Modal */}
                          {isAdmin && !bill.isVoided && bill.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}
                              onClick={() => setReminderBillId(bill._id)}
                              title="Send Payment Reminder (WhatsApp / SMS)"
                            >
                              Send Reminder
                            </button>
                          )}

                          {/* Admin Only: Quick Clone / Duplicate Invoice */}
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontWeight: 600 }}
                              onClick={() => navigate('/new-bill', { state: { cloneBill: bill } })}
                              title="Duplicate this invoice"
                            >
                              Duplicate
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handlePrint(e, bill._id)}
                            title="Print Invoice"
                          >
                            <PrintIcon size={14} /> Print
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handleDownloadPDF(e, bill._id, bill.formattedBillNo || bill.billNumber || bill.billNo)}
                            disabled={downloadingPdfId === bill._id}
                            title="Download PDF"
                            style={{ minWidth: '66px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            {downloadingPdfId === bill._id ? (
                              <>
                                <span className="btn-spinner" style={{ width: '12px', height: '12px' }}></span> PDF...
                              </>
                            ) : (
                              <>
                                <DownloadIcon size={14} /> PDF
                              </>
                            )}
                          </button>
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
                      ⚡ {t('loadMore') || 'Load More'}
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
                      📄 Pages
                    </button>
                  </div>
                )}
              </div>

              {/* In Scroll / Load More Mode */}
              {displayMode === 'scroll' ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {bills.length < (pagination.total || 0) ? (
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
          <div className="empty-state">
            <p>No invoices found</p>
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
      </div>
    </PullToRefresh>
  );
}

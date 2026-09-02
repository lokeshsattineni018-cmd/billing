import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, useToast, Toast, shareInvoicePDFOnWhatsApp } from '../utils/helpers';
import { SearchIcon, PrintIcon, DownloadIcon, WhatsAppIcon, DownloadIcon as ExportIcon, PlusIcon, ShareIcon } from '../components/Icons';
import ReminderModal from '../components/ReminderModal';
import PaymentModal from '../components/PaymentModal';

export default function BillHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showToast } = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadBills();
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

      const response = await billsAPI.list(params);
      setBills(response.data.bills);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
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
    const pdfUrl = billsAPI.getPDF(id);
    window.open(pdfUrl, '_blank');
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
      console.error('Download error:', error);
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
      console.error('WhatsApp share error:', err);
    }
  };

  const handleTogglePaymentStatus = async (e, bill) => {
    e.stopPropagation();
    if (!canUpdateStatus) return;

    if (bill.isVoided) {
      showToast('Cannot change status of a voided invoice', 'error');
      return;
    }

    const newStatus = bill.paymentStatus === 'Paid' ? 'Pending' : 'Paid';
    const confirmMsg = `Mark Invoice #${bill.billNo} (${bill.companyName}) as "${newStatus}"?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await billsAPI.updatePaymentStatus(bill._id, newStatus);
      showToast(`Invoice #${bill.billNo} marked as ${newStatus}`);
      setBills(bills.map((b) => (b._id === bill._id ? { ...b, paymentStatus: newStatus } : b)));
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update payment status', 'error');
    }
  };

  return (
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

          <div className="filter-actions-group">
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
              }}
            >
              <SearchIcon size={16} color="#ffffff" /> Search
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0 14px', color: '#64748b', height: '42px', borderRadius: '8px' }}
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
          <div className="spinner"></div>
        ) : bills.length > 0 ? (
          <>
            {/* Mobile Cards View (Visible on Phones & Tablets) */}
            <div className="mobile-bills-list">
              {bills.map((bill) => (
                <div key={bill._id} className="mobile-bill-card" style={bill.isVoided ? { background: '#fef2f2', border: '1px dashed #fca5a5', opacity: 0.85 } : {}}>
                  <div className="mobile-bill-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-blue">#{bill.billNo}</span>
                      {bill.isVoided && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800 }}>
                          ⛔ VOIDED
                        </span>
                      )}
                      <span className="mobile-bill-date">{formatDate(bill.date)}</span>
                    </div>
                    {!bill.isVoided && (
                      <span
                        className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                        style={{ cursor: canUpdateStatus ? 'pointer' : 'default', padding: '4px 10px', fontSize: '0.82rem' }}
                        onClick={(e) => handleTogglePaymentStatus(e, bill)}
                      >
                        {bill.paymentStatus || 'Pending'}
                      </span>
                    )}
                  </div>

                  <div className="mobile-bill-body" onClick={() => navigate(`/bills/${bill._id}`)}>
                    <div style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: bill.isVoided ? '#991b1b' : 'var(--text-primary)',
                      marginBottom: '4px',
                      textDecoration: bill.isVoided ? 'line-through' : 'none',
                    }}>
                      {bill.companyName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Weight: <strong>{bill.quantity} kg</strong></span>
                      {canSeeSales && (
                        <span style={{
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          color: bill.isVoided ? '#dc2626' : 'var(--accent-primary)',
                          textDecoration: bill.isVoided ? 'line-through' : 'none',
                        }}>
                          {formatCurrency(bill.grandTotal || bill.total)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mobile-bill-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 8px',
                        fontSize: '0.85rem',
                        background: '#ffffff',
                        border: '1.5px solid #0b5394',
                        color: '#0b5394',
                        fontWeight: 700,
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(11, 83, 148, 0.08)'
                      }}
                      onClick={(e) => handleDownloadPDF(e, bill._id, bill.formattedBillNo || bill.billNumber || bill.billNo)}
                      disabled={downloadingPdfId === bill._id}
                    >
                      {downloadingPdfId === bill._id ? (
                        <>
                          <span className="btn-spinner"></span> Downloading...
                        </>
                      ) : (
                        <>
                          <DownloadIcon size={16} color="#0b5394" /> Download PDF
                        </>
                      )}
                    </button>
                    {!bill.isVoided && (
                      <button
                        className="btn btn-whatsapp btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '6px' }}
                        onClick={(e) => handleShareWhatsApp(e, bill)}
                      >
                        <WhatsAppIcon size={16} color="#ffffff" /> WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                      <td className="text-right">{bill.quantity} kg</td>
                      <td>
                        {bill.isVoided ? (
                          <span className="badge" style={{ background: '#fecaca', color: '#991b1b', fontWeight: 700 }}>
                            Voided
                          </span>
                        ) : (
                          <span
                            className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                            style={{ cursor: canUpdateStatus ? 'pointer' : 'default' }}
                            onClick={(e) => handleTogglePaymentStatus(e, bill)}
                            title={canUpdateStatus ? 'Click to toggle status' : ''}
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

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
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
            )}
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
  );
}

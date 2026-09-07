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

  // Bulk Payment States
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState('Cash');
  const [bulkRef, setBulkRef] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadBills();
    setSelectedBillIds([]);
  }, [page, statusFilter]);

  const toggleSelectBill = (id) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const eligibleBills = bills.filter((b) => !b.isVoided && b.paymentStatus !== 'Paid');
  const isAllEligibleSelected =
    eligibleBills.length > 0 && eligibleBills.every((b) => selectedBillIds.includes(b._id));

  const toggleSelectAll = () => {
    if (isAllEligibleSelected) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(eligibleBills.map((b) => b._id));
    }
  };

  const selectedTotal = bills
    .filter((b) => selectedBillIds.includes(b._id))
    .reduce((sum, b) => {
      const g = b.grandTotal || b.total || 0;
      const p = b.paidAmount || 0;
      return sum + Math.max(0, g - p);
    }, 0);

  const handleBulkPaySubmit = async (e) => {
    e.preventDefault();
    if (selectedBillIds.length === 0) return;
    setSubmittingBulk(true);
    try {
      const res = await billsAPI.bulkPay({
        billIds: selectedBillIds,
        paymentMode: bulkMode,
        reference: bulkRef,
        notes: bulkNotes,
      });
      showToast(res.data.message || 'Bulk payment recorded successfully!', 'success');
      setShowBulkModal(false);
      setSelectedBillIds([]);
      setBulkRef('');
      setBulkNotes('');
      loadBills();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record bulk payment', 'error');
    } finally {
      setSubmittingBulk(false);
    }
  };

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
          <div className="spinner"></div>
        ) : bills.length > 0 ? (
          <>
            {/* Mobile Cards View (Visible on Phones & Tablets) */}
            <div className="mobile-bills-list">
              {bills.map((bill) => (
                <div key={bill._id} className="mobile-bill-card" style={bill.isVoided ? { background: '#fef2f2', border: '1px dashed #fca5a5', opacity: 0.85 } : {}}>
                  <div className="mobile-bill-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {canUpdateStatus && !bill.isVoided && bill.paymentStatus !== 'Paid' && (
                        <input
                          type="checkbox"
                          checked={selectedBillIds.includes(bill._id)}
                          onChange={() => toggleSelectBill(bill._id)}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)', marginRight: '2px' }}
                        />
                      )}
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
                        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
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
                    {canUpdateStatus && (
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isAllEligibleSelected}
                          onChange={toggleSelectAll}
                          title="Select all pending invoices on this page"
                          style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                        />
                      </th>
                    )}
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
                      {canUpdateStatus && (
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {!bill.isVoided && bill.paymentStatus !== 'Paid' ? (
                            <input
                              type="checkbox"
                              checked={selectedBillIds.includes(bill._id)}
                              onChange={() => toggleSelectBill(bill._id)}
                              style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                            />
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                      )}
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

      {/* Floating Bulk Action Bar */}
      {selectedBillIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            zIndex: 1000,
            maxWidth: '90vw',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            ✓ {selectedBillIds.length} invoice(s) selected (Total: {formatCurrency(selectedTotal)})
          </span>
          {canUpdateStatus && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ background: '#10b981', border: 'none', fontWeight: 800, padding: '7px 16px', borderRadius: '20px' }}
              onClick={() => setShowBulkModal(true)}
            >
              Mark as Paid
            </button>
          )}
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setSelectedBillIds([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk Payment Confirmation Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Payment Settlement</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowBulkModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkPaySubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 700 }}>
                    Confirm Settlement for {selectedBillIds.length} Invoices
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
                    {formatCurrency(selectedTotal)}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#166534', margin: '4px 0 0 0' }}>
                    All selected invoices will be marked as fully Paid and payment entries recorded.
                  </p>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                    Payment Mode
                  </label>
                  <select
                    className="form-select"
                    value={bulkMode}
                    onChange={(e) => setBulkMode(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                    Reference / Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UTR / UPI Ref / Cheque No."
                    value={bulkRef}
                    onChange={(e) => setBulkRef(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Cleared via bulk settlement"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBulkModal(false)}
                  disabled={submittingBulk}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#10b981', border: 'none', fontWeight: 800 }}
                  disabled={submittingBulk}
                >
                  {submittingBulk ? 'Processing...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

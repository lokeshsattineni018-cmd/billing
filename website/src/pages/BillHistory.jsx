import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, useToast, Toast, exportBillsToCSV } from '../utils/helpers';
import { SearchIcon, PrintIcon, DownloadIcon, WhatsAppIcon, DownloadIcon as ExportIcon } from '../components/Icons';

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
    try {
      const pdfUrl = billsAPI.getPDF(id);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${billNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast('Failed to download PDF', 'error');
    }
  };

  const handleShareWhatsApp = (e, bill) => {
    e.stopPropagation();
    const pdfUrl = billsAPI.getPDF(bill._id);
    const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
    const amountStr = formatCurrency(bill.grandTotal || bill.total);
    const rawPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
    const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const message = `*VIJAYA DURGA AGENCIES*
*Tax Invoice #${bill.billNo}*

Dear ${bill.companyName},
Please find your invoice details below:
📅 Date: ${formattedDate}
💰 Total Amount: ${amountStr}

📄 View & Download Invoice PDF:
${pdfUrl}

Thank you for your business!`;

    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
    showToast('Opening WhatsApp...');
  };

  const handleTogglePaymentStatus = async (e, bill) => {
    e.stopPropagation();
    if (!canUpdateStatus) return;

    const newStatus = bill.paymentStatus === 'Paid' ? 'Pending' : 'Paid';
    try {
      await billsAPI.updatePaymentStatus(bill._id, newStatus);
      showToast(`Invoice #${bill.billNo} marked as ${newStatus}`);
      setBills(bills.map((b) => (b._id === bill._id ? { ...b, paymentStatus: newStatus } : b)));
    } catch (error) {
      showToast('Failed to update payment status', 'error');
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

        {canSeeSales && (
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={exporting || loading}
            title="Export all filtered bills to CSV for GST / CA accounting"
          >
            <ExportIcon size={16} /> {exporting ? 'Exporting...' : 'Export Excel / CSV'}
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by company name or invoice number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className="form-input"
          style={{ maxWidth: '160px' }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From Date"
        />
        <input
          type="date"
          className="form-input"
          style={{ maxWidth: '160px' }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To Date"
        />
        <select
          className="form-select"
          style={{ maxWidth: '150px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Paid">Paid Only</option>
          <option value="Pending">Pending Only</option>
        </select>
        <button type="submit" className="btn btn-primary">
          <SearchIcon size={16} /> Search
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
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
                <div key={bill._id} className="mobile-bill-card">
                  <div className="mobile-bill-header" onClick={() => navigate(`/bills/${bill._id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '4px 8px' }}>#{bill.billNo}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatDate(bill.date)}</span>
                    </div>
                    <span
                      className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                      style={{ cursor: canUpdateStatus ? 'pointer' : 'default', padding: '4px 10px', fontSize: '0.82rem' }}
                      onClick={(e) => handleTogglePaymentStatus(e, bill)}
                    >
                      {bill.paymentStatus || 'Pending'}
                    </span>
                  </div>

                  <div className="mobile-bill-body" onClick={() => navigate(`/bills/${bill._id}`)}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {bill.companyName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Weight: <strong>{bill.quantity} kg</strong></span>
                      {canSeeSales && (
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                          {formatCurrency(bill.grandTotal || bill.total)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mobile-bill-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', fontSize: '0.85rem' }}
                      onClick={(e) => handleDownloadPDF(e, bill._id, bill.billNo)}
                    >
                      <DownloadIcon size={16} /> Download PDF
                    </button>
                    <button
                      className="btn btn-whatsapp btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', fontSize: '0.85rem' }}
                      onClick={(e) => handleShareWhatsApp(e, bill)}
                    >
                      <WhatsAppIcon size={16} color="#ffffff" /> WhatsApp
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '10px 12px' }}
                      onClick={(e) => handlePrint(e, bill._id)}
                    >
                      <PrintIcon size={16} />
                    </button>
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
                    <tr key={bill._id}>
                      <td>
                        <span className="badge badge-blue">#{bill.billNo}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
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
                        <span
                          className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}
                          style={{ cursor: canUpdateStatus ? 'pointer' : 'default' }}
                          onClick={(e) => handleTogglePaymentStatus(e, bill)}
                          title={canUpdateStatus ? 'Click to toggle status' : ''}
                        >
                          {bill.paymentStatus || 'Pending'}
                        </span>
                      </td>
                      {canSeeSales && (
                        <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatCurrency(bill.grandTotal || bill.total)}
                        </td>
                      )}
                      <td className="text-center">
                        <div className="action-buttons" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn btn-whatsapp btn-sm"
                            onClick={(e) => handleShareWhatsApp(e, bill)}
                            title="Share on WhatsApp"
                          >
                            <WhatsAppIcon size={14} color="#ffffff" /> Share
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handlePrint(e, bill._id)}
                            title="Print Invoice"
                          >
                            <PrintIcon size={14} /> Print
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handleDownloadPDF(e, bill._id, bill.billNo)}
                            title="Download PDF"
                          >
                            <DownloadIcon size={14} /> PDF
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
                        {showEllipsis && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                        <button
                          className={p === page ? 'active' : ''}
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
    </div>
  );
}

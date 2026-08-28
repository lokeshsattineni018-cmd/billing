import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, useToast, Toast } from '../utils/helpers';
import { PrintIcon, DownloadIcon, ArrowLeftIcon, WhatsAppIcon, PlusIcon } from '../components/Icons';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadBill();
  }, [id]);

  const loadBill = async () => {
    try {
      const response = await billsAPI.getById(id);
      setBill(response.data);
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const pdfUrl = billsAPI.getPDF(id);
    window.open(pdfUrl, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const pdfUrl = billsAPI.getPDF(id);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${bill.billNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast('Failed to download PDF', 'error');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!bill) return;
    setSharing(true);

    const pdfUrl = billsAPI.getPDF(id);
    const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
    const amountStr = formatCurrency(bill.grandTotal || bill.total);
    const phone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';

    // 1. Try sharing the actual PDF file using Web Share API (native share on mobile & supported desktop)
    if (navigator.canShare && navigator.share) {
      try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], `Invoice-${bill.billNo}.pdf`, { type: 'application/pdf' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Tax Invoice #${bill.billNo} - VIJAYA DURGA AGENCIES`,
            text: `*VIJAYA DURGA AGENCIES*\n*Tax Invoice #${bill.billNo}*\n📅 Date: ${formattedDate}\n💰 Total: ${amountStr}\n\nThank you for your business!`,
          });
          showToast('Shared successfully');
          setSharing(false);
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setSharing(false);
          return;
        }
        console.error('File share fallback:', err);
      }
    }

    // 2. Direct WhatsApp Web / App share with message and PDF link
    const message = `*VIJAYA DURGA AGENCIES*
*Tax Invoice #${bill.billNo}*

Dear ${bill.companyName},
Please find your invoice details below:
📅 Date: ${formattedDate}
💰 Total Amount: ${amountStr}

📄 View & Download Invoice PDF:
${pdfUrl}

Thank you for your business!`;

    const waUrl = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
    setSharing(false);
  };

  const handleUpdatePaymentStatus = async (newStatus) => {
    try {
      const response = await billsAPI.updatePaymentStatus(id, newStatus);
      setBill(response.data);
      showToast(`Invoice #${bill.billNo} payment status updated to ${newStatus}`);
    } catch (error) {
      showToast('Failed to update payment status', 'error');
    }
  };

  if (loading) return <div className="spinner"></div>;
  if (!bill) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p>Invoice not found</p>
          <button className="btn btn-primary" onClick={() => navigate('/bills')}>
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const itemsList = bill.items && bill.items.length > 0 ? bill.items : [{
    sno: 1,
    particulars: bill.particulars || 'Fresh Seafood / Prawns Supply',
    hsn: bill.hsn || '0306',
    quantity: bill.quantity,
    rate: bill.rate,
    taxRate: '',
    amount: bill.total,
  }];

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      <div className="bill-detail-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 800 }}>
            Invoice <span style={{ color: 'var(--accent-primary)' }}>#{bill.billNo}</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.88rem' }}>
            {formatDateTime(bill.date)}
          </p>
        </div>

        <div className="action-buttons" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontWeight: 700, padding: '10px 18px' }}
            onClick={handleDownloadPDF}
          >
            <DownloadIcon size={18} /> Download PDF
          </button>
          <button
            className="btn btn-whatsapp"
            style={{ fontWeight: 700, padding: '10px 18px' }}
            onClick={handleShareWhatsApp}
            disabled={sharing}
          >
            <WhatsAppIcon size={18} color="#ffffff" /> {sharing ? 'Sharing...' : 'Share on WhatsApp'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/new-bill', { state: { cloneBill: bill } })}
            title="Create a new bill pre-filled with this customer and items"
          >
            <PlusIcon size={16} /> Re-Bill
          </button>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <PrintIcon size={16} /> Print
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/bills')}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        </div>
      </div>

      {/* Invoice Details Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Invoice Header</h3>
          <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
            Status: {bill.paymentStatus || 'Pending'}
          </span>
        </div>

        <div className="detail-grid" style={{ marginBottom: '20px' }}>
          <div className="detail-item">
            <span className="detail-label">Invoice Number</span>
            <span className="detail-value">#{bill.billNo}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Invoice Date</span>
            <span className="detail-value">{formatDateTime(bill.date)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">M/s Customer Name</span>
            <span className="detail-value" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{bill.companyName}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">GSTIN (Fixed)</span>
            <span className="detail-value">{bill.companyGstin || '37KATPS1500Q1ZR'}</span>
          </div>

          {bill.customerPhone && (
            <div className="detail-item">
              <span className="detail-label">Customer Cell</span>
              <span className="detail-value">{bill.customerPhone}</span>
            </div>
          )}
        </div>

        {/* Bill Items Table */}
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
          Items Breakdown
        </h4>
        <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                <th>PARTICULARS</th>
                <th style={{ width: '90px', textAlign: 'center' }}>HSN</th>
                <th style={{ width: '120px', textAlign: 'right' }}>QTY (KG)</th>
                <th style={{ width: '120px', textAlign: 'right' }}>PRICE (₹)</th>
                <th style={{ width: '100px', textAlign: 'center' }}>TAX RATE</th>
                {canSeeSales && <th style={{ width: '140px', textAlign: 'right' }}>AMOUNT (₹)</th>}
              </tr>
            </thead>
            <tbody>
              {itemsList.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{it.particulars || 'Fresh Seafood / Prawns Supply'}</td>
                  <td style={{ textAlign: 'center' }}>{it.hsn || '0306'}</td>
                  <td style={{ textAlign: 'right' }}>{it.quantity} kg</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate)}</td>
                  <td style={{ textAlign: 'center' }}>{it.taxRate || '—'}</td>
                  {canSeeSales && (
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatCurrency(it.amount || it.quantity * it.rate)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Update Payment Status Section for Owner/Admin */}
        {canUpdateStatus && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Update Payment Status:</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className={`btn ${bill.paymentStatus === 'Paid' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => handleUpdatePaymentStatus('Paid')}
                disabled={bill.paymentStatus === 'Paid'}
              >
                Mark as Paid
              </button>
              <button
                className={`btn ${bill.paymentStatus === 'Pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => handleUpdatePaymentStatus('Pending')}
                disabled={bill.paymentStatus === 'Pending'}
              >
                Mark as Pending
              </button>
            </div>
          </div>
        )}

        {/* Calculated Total (Visible to Owner & Admin) */}
        {canSeeSales && (
          <div className="invoice-total-section">
            <div className="invoice-total-box">
              <div className="invoice-total-label">GRAND TOTAL</div>
              <div className="invoice-total-value">{formatCurrency(bill.grandTotal || bill.total)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

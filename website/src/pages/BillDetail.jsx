import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, useToast, Toast } from '../utils/helpers';
import { PrintIcon, DownloadIcon, WhatsAppIcon, PlusIcon, ArrowLeftIcon } from '../components/Icons';
import logoImg from '../assets/logo.png';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

      // Check if redirected from NewBill with autoprint=true
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('autoprint') === 'true') {
        setTimeout(() => {
          window.print();
        }, 350);
      }
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut Ctrl+P / Cmd+P
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrint = () => {
    window.print();
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
      showToast('Failed to update status', 'error');
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

      {/* Screen Header (Hidden during Print) */}
      <div className="bill-detail-header no-print">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            Invoice <span style={{ color: '#0b5394' }}>#{bill.billNo}</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.85rem' }}>
            {formatDateTime(bill.date)}
          </p>
        </div>

        <div className="action-buttons" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontWeight: 700, padding: '10px 18px', background: '#0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handlePrint}
            title="Direct Print (Ctrl + P)"
          >
            <PrintIcon size={18} /> Print Invoice
          </button>

          <button
            className="btn btn-whatsapp"
            style={{ fontWeight: 700, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleShareWhatsApp}
            disabled={sharing}
          >
            <WhatsAppIcon size={18} color="#ffffff" /> {sharing ? 'Sharing...' : 'WhatsApp'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '10px 14px' }}
            onClick={handleDownloadPDF}
          >
            <DownloadIcon size={16} /> PDF
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '10px 14px' }}
            onClick={() => navigate('/new-bill', { state: { cloneBill: bill } })}
            title="Create a new bill pre-filled with this customer and items"
          >
            <PlusIcon size={16} /> Re-Bill
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bills')}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        </div>
      </div>

      {/* Screen Invoice Details Card (Hidden during Print) */}
      <div className="card no-print" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Invoice Details</h3>
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
                {canSeeSales && <th style={{ width: '140px', textAlign: 'right' }}>AMOUNT (₹)</th>}
              </tr>
            </thead>
            <tbody>
              {itemsList.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.sno || index + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.particulars}</td>
                  <td style={{ textAlign: 'center' }}>{item.hsn || '0306'}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{item.quantity} kg</td>
                  <td className="text-right">{formatCurrency(item.rate)}</td>
                  {canSeeSales && (
                    <td className="text-right" style={{ fontWeight: 700 }}>
                      {formatCurrency(item.amount || item.quantity * item.rate)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand Total */}
        <div className="invoice-total-section">
          <div className="invoice-total-box" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '10px' }}>
            <div className="invoice-total-label" style={{ fontSize: '0.85rem' }}>TOTAL AMOUNT</div>
            <div className="invoice-total-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0b5394' }}>
              {formatCurrency(bill.grandTotal || bill.total)}
            </div>
          </div>
        </div>

        {/* Payment Status Toggle (Owner/Admin) */}
        {canUpdateStatus && (
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Update Payment Status:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn btn-sm ${bill.paymentStatus === 'Paid' ? 'btn-primary' : 'btn-secondary'}`}
                style={bill.paymentStatus === 'Paid' ? { background: '#16a34a' } : {}}
                onClick={() => handleUpdatePaymentStatus('Paid')}
              >
                Mark as Paid
              </button>
              <button
                className={`btn btn-sm ${bill.paymentStatus !== 'Paid' ? 'btn-primary' : 'btn-secondary'}`}
                style={bill.paymentStatus !== 'Paid' ? { background: '#d97706' } : {}}
                onClick={() => handleUpdatePaymentStatus('Pending')}
              >
                Mark as Pending
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DEDICATED HIGH-RES PRINT LAYOUT (Visible ONLY during window.print()) ── */}
      <div className="print-only-layout">
        <div style={{ border: '2px solid #000000', padding: '24px', background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
          
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src={logoImg} alt="Emblem" style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  TAX INVOICE (ORIGINAL FOR RECIPIENT)
                </div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '900', margin: '2px 0', color: '#000000' }}>
                  VIJAYA DURGA AGENCIES
                </h1>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  WHOLESALE SEAFOOD & PRAWNS TRADERS
                </div>
                <div style={{ fontSize: '0.75rem', color: '#333333' }}>
                  D.No. 4-23, Main Road, Undi / Bhimavaram, W.G. Dist, Andhra Pradesh
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
              <div><strong>GSTIN:</strong> 37KATPS1500Q1ZR</div>
              <div><strong>Cell:</strong> 9848136363</div>
              <div><strong>State:</strong> Andhra Pradesh (37)</div>
            </div>
          </div>

          {/* Bill Meta Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', border: '1px solid #000000', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#555555', textTransform: 'uppercase' }}>Billed To:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '2px 0' }}>{bill.companyName}</div>
              {bill.customerPhone && <div>Cell: {bill.customerPhone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>INVOICE #{bill.billNo}</div>
              <div><strong>Date:</strong> {new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div><strong>Payment:</strong> {bill.paymentStatus || 'Pending'}</div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '14px', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000000' }}>
                <th style={{ borderRight: '1px solid #000000', padding: '8px 6px', width: '40px', textAlign: 'center' }}>S.No</th>
                <th style={{ borderRight: '1px solid #000000', padding: '8px 10px', textAlign: 'left' }}>Description of Goods</th>
                <th style={{ borderRight: '1px solid #000000', padding: '8px 6px', width: '70px', textAlign: 'center' }}>HSN</th>
                <th style={{ borderRight: '1px solid #000000', padding: '8px 10px', width: '100px', textAlign: 'right' }}>Quantity</th>
                <th style={{ borderRight: '1px solid #000000', padding: '8px 10px', width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '8px 10px', width: '130px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ borderRight: '1px solid #000000', padding: '8px 6px', textAlign: 'center' }}>{it.sno || idx + 1}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '8px 10px', fontWeight: 'bold' }}>{it.particulars}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '8px 6px', textAlign: 'center' }}>{it.hsn || '0306'}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{it.quantity} kg</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '8px 10px', textAlign: 'right' }}>{Number(it.rate).toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                    {Number(it.amount || it.quantity * it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Bank Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', border: '1px solid #000000', padding: '12px 14px', marginBottom: '14px', fontSize: '0.82rem' }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>BANK PAYMENT DETAILS:</div>
              <div>Bank Name: <strong>Karur Vysya Bank</strong></div>
              <div>Account Name: <strong>VIJAYA DURGA AGENCIES</strong></div>
              <div>Account No: <strong>4103135000008500</strong></div>
              <div>IFSC Code: <strong>KVBL0004103</strong></div>
              <div>Branch: <strong>Undi Branch</strong></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                Items Subtotal: <strong>₹ {Number(bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ borderTop: '2px solid #000000', paddingTop: '6px', fontSize: '1.35rem', fontWeight: '900' }}>
                Total: ₹ {Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Signatures Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '28px', fontSize: '0.82rem' }}>
            <div>
              <div>Customer Signature: __________________</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '32px' }}>For VIJAYA DURGA AGENCIES</div>
              <div>Authorised Signatory</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

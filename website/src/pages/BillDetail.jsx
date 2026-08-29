import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, numberToWords, useToast, Toast } from '../utils/helpers';
import { PrintIcon, DownloadIcon, WhatsAppIcon, PlusIcon, ArrowLeftIcon } from '../components/Icons';
import ganeshaImg from '../assets/ganesha.jpg';
import durgaImg from '../assets/durga.jpg';
import ramDarbarImg from '../assets/ram_darbar.jpg';

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

  const billDate = new Date(bill.date);
  const dd = String(billDate.getDate()).padStart(2, '0');
  const mm = String(billDate.getMonth() + 1).padStart(2, '0');
  const yyyy = billDate.getFullYear();
  const formattedDate = `${dd}-${mm}-${yyyy}`;
  const finalAmount = bill.grandTotal || bill.total || 0;
  const amountInWordsText = numberToWords(finalAmount);

  // Empty grid lines to match authentic printed bill book
  const emptyRowsCount = Math.max(1, 6 - itemsList.length);

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
            className="btn btn-secondary"
            style={{ fontWeight: 800, padding: '10px 18px', background: '#ffffff', border: '1.5px solid #0b5394', color: '#0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handlePrint}
            title="Direct Print (Ctrl + P)"
          >
            <PrintIcon size={18} color="#0b5394" /> Print Invoice
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

      {/* ══════════════════════════════════════════════════════════════════════════
          EXACT OFFICIAL INVOICE TEMPLATE (Matches user's reference image 100%)
          Visible on screen preview & during window.print()
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="official-invoice-frame">
        <div style={{
          border: '1.5px solid #0b5394',
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: '0 auto',
          maxWidth: '800px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>

          {/* 1. TOP BAR */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '4px 12px',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            color: '#0b5394'
          }}>
            <div style={{ textAlign: 'left', letterSpacing: '0.5px' }}>
              TAX INVOICE / CASH / CREDIT
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, color: '#0b5394', letterSpacing: '1px', fontFamily: "'Noto Sans Telugu', 'Segoe UI', Arial, sans-serif" }}>
              ॥ జై శ్రీరామ్ ॥
            </div>
            <div style={{ textAlign: 'right' }}>
              Cell: 9441429745
            </div>
          </div>

          {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 70px',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '8px 12px',
            gap: '8px'
          }}>
            {/* Left: Lord Vinayaka */}
            <div style={{ textAlign: 'center' }}>
              <img src={ganeshaImg} alt="Lord Ganesha" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            </div>

            {/* Center: Title & Address */}
            <div style={{ textAlign: 'center' }}>
              <img src={durgaImg} alt="Maa Durga" style={{ width: '26px', height: '26px', objectFit: 'contain', display: 'block', margin: '0 auto 2px auto' }} />
              <h1 style={{
                fontSize: '1.45rem',
                fontWeight: 900,
                color: '#0b5394',
                margin: '0 0 3px 0',
                letterSpacing: '0.5px',
                fontFamily: 'Arial, sans-serif'
              }}>
                VIJAYA DURGA AGENCIES
              </h1>
              <div style={{ fontSize: '0.74rem', fontWeight: 'bold', color: '#000000', marginBottom: '2px' }}>
                Prop: SATTINENI VENKATA DHANA LAXMI &nbsp;|&nbsp; GSTIN: 37KATPS1500Q1ZR
              </div>
              <div style={{ fontSize: '0.68rem', color: '#333333' }}>
                D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.
              </div>
            </div>

            {/* Right: Sri Ram Darbar */}
            <div style={{ textAlign: 'center' }}>
              <img src={ramDarbarImg} alt="Sri Ram Darbar" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            </div>
          </div>

          {/* 3. NO. & DATE ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1.5px solid #0b5394',
            fontSize: '0.85rem'
          }}>
            <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>No.</span>
              <span style={{ fontWeight: 900, color: '#b12704', fontSize: '1rem' }}>{bill.billNo}</span>
            </div>
            <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{formattedDate}</span>
            </div>
          </div>

          {/* 4. M/S CUSTOMER NAME ROW */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '5px 10px',
            gap: '10px',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontWeight: 'bold', color: '#0b5394' }}>M/s</span>
            <span style={{ fontWeight: 800, color: '#000000', fontSize: '1rem' }}>{bill.companyName}</span>
          </div>

          {/* 5. GSTIN & CELL ROW */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '5px 10px',
            fontSize: '0.82rem'
          }}>
            <div>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>GSTIN : &nbsp;</span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{bill.companyGstin || '37KATPS1500Q1ZR'}</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Cell : &nbsp;</span>
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{bill.customerPhone || '9441429745'}</span>
            </div>
          </div>

          {/* 6. MAIN ITEMS TABLE */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f0f5fa', borderBottom: '1.5px solid #0b5394', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 4px', width: '38px' }}>S.<br />No.</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 8px' }}>PARTICULARS</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 4px', width: '55px' }}>HSN</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 6px', width: '60px' }}>QTY.</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 6px', width: '68px' }}>PRICE</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '5px 4px', width: '60px' }}>RATE<br />OF TAX</th>
                <th style={{ padding: '5px 8px', width: '105px', textAlign: 'center' }}>
                  AMOUNT<br />
                  <span style={{ fontSize: '0.72rem' }}>Rs. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Ps.</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((it, idx) => (
                <tr key={idx} style={{ height: '24px', borderBottom: '1px solid #c8d9e8' }}>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>{it.sno || idx + 1}</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', padding: '3px 8px', fontWeight: 'bold' }}>{it.particulars}</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center' }}>{it.hsn || '0306'}</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'normal' }}>{it.quantity} kg</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '6px' }}>{Number(it.rate).toFixed(2)}</td>
                  <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center' }}>{it.taxRate || ''}</td>
                  <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                    {Number(it.amount || it.quantity * it.rate).toFixed(2)}
                  </td>
                </tr>
              ))}

              {/* Blank rows to match billbook aesthetic */}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ height: '20px', borderBottom: '1px solid #c8d9e8' }}>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td></td>
                </tr>
              ))}

              {/* Table Total Row */}
              <tr style={{ background: '#f0f5fa', borderTop: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                <td colSpan={6} style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', padding: '6px 14px', color: '#0b5394', fontSize: '0.92rem' }}>
                  TOTAL
                </td>
                <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.95rem', fontWeight: 900 }}>
                  {Number(bill.total || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 7. TAX BREAKDOWN SECTION */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', borderBottom: '1.5px solid #0b5394' }}>
            <thead>
              <tr style={{ background: '#f0f5fa', borderBottom: '1px solid #0b5394', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '4px', width: '22%' }}>Taxable Value</th>
                <th colSpan={2} style={{ borderRight: '1.5px solid #0b5394', padding: '4px', width: '26%' }}>CGST Tax</th>
                <th colSpan={2} style={{ borderRight: '1.5px solid #0b5394', padding: '4px', width: '26%' }}>SGST Tax</th>
                <th style={{ padding: '4px', width: '26%' }}>IGST Tax</th>
              </tr>
              <tr style={{ borderBottom: '1px solid #0b5394', color: '#0b5394', textAlign: 'center' }}>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '2px' }}></th>
                <th style={{ borderRight: '1px solid #0b5394', padding: '2px', width: '11%' }}>Rate</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '2px', width: '15%' }}>Amount</th>
                <th style={{ borderRight: '1px solid #0b5394', padding: '2px', width: '11%' }}>Rate</th>
                <th style={{ borderRight: '1.5px solid #0b5394', padding: '2px', width: '15%' }}>Amount</th>
                <th style={{ padding: '2px', width: '26%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: '22px', textAlign: 'center', borderBottom: '1.5px solid #0b5394' }}>
                <td style={{ borderRight: '1.5px solid #0b5394', padding: '2px' }}>
                  {bill.taxableValue ? Number(bill.taxableValue).toFixed(2) : Number(bill.total || 0).toFixed(2)}
                </td>
                <td style={{ borderRight: '1px solid #0b5394', padding: '2px' }}>{bill.cgstRate || '2.5'}</td>
                <td style={{ borderRight: '1.5px solid #0b5394', padding: '2px' }}>{bill.cgstAmount ? Number(bill.cgstAmount).toFixed(2) : '100.00'}</td>
                <td style={{ borderRight: '1px solid #0b5394', padding: '2px' }}>{bill.sgstRate || '2.5'}</td>
                <td style={{ borderRight: '1.5px solid #0b5394', padding: '2px' }}>{bill.sgstAmount ? Number(bill.sgstAmount).toFixed(2) : '100.00'}</td>
                <td style={{ padding: '2px' }}>{bill.igstAmount ? Number(bill.igstAmount).toFixed(2) : '100.00'}</td>
              </tr>

              {/* GRAND TOTAL ROW */}
              <tr style={{ background: '#e8f1f8', fontWeight: 'bold' }}>
                <td colSpan={5} style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', padding: '7px 14px', color: '#0b5394', fontSize: '0.98rem' }}>
                  GRAND TOTAL
                </td>
                <td style={{ textAlign: 'right', padding: '7px 10px', fontSize: '1.1rem', fontWeight: 900 }}>
                  {Number(finalAmount).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 8. BANK DETAILS & PROPRIETOR SIGNATURE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            fontSize: '0.78rem'
          }}>
            {/* Left Box: Bank Details */}
            <div style={{ padding: '8px 12px', borderRight: '1.5px solid #0b5394' }}>
              <div style={{ fontWeight: 'bold', color: '#0b5394', marginBottom: '3px' }}>
                BANK : KARUR VYSYA BANK
              </div>
              <div style={{ marginBottom: '2px' }}><strong>A/c. NO :</strong> 4805135000002964</div>
              <div style={{ marginBottom: '2px' }}><strong>IFSC :</strong> KVBL0004815</div>
              <div style={{ marginBottom: '6px' }}><strong>Branch :</strong> Narasapur</div>
              <div style={{ fontSize: '0.66rem', color: '#444444' }}>
                Goods once sold will not be taken back. Subject to local Jurisdiction.
              </div>
            </div>

            {/* Right Box: Signature */}
            <div style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.85rem' }}>
                For VIJAYA DURGA AGENCIES
              </div>
              <div style={{ marginTop: '34px' }}>
                <div style={{ width: '180px', height: '1px', background: '#0b5394', margin: '0 auto 4px auto' }}></div>
                <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.82rem' }}>Proprietor</div>
              </div>
            </div>
          </div>

        </div>

        {/* 9. AMOUNT IN WORDS */}
        <div style={{ maxWidth: '800px', margin: '8px auto 0 auto', fontSize: '0.82rem', padding: '0 4px' }}>
          <strong style={{ color: '#0b5394' }}>Amount in Words: </strong>
          <span style={{ color: '#000000', fontWeight: 'bold' }}>{amountInWordsText}</span>
        </div>
      </div>

    </div>
  );
}

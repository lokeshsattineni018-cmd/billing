import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, numberToWords, useToast, Toast } from '../utils/helpers';
import { PrintIcon, DownloadIcon, WhatsAppIcon, PlusIcon, ArrowLeftIcon } from '../components/Icons';
import ReminderModal from '../components/ReminderModal';
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
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Void Action State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadBill();
  }, [id]);

  const loadBill = async () => {
    try {
      const response = await billsAPI.getById(id);
      setBill(response.data);

      // Populate edit fields
      setEditCompanyName(response.data.companyName || '');
      setEditCustomerPhone(response.data.customerPhone || '');
      setEditItems(
        response.data.items && response.data.items.length > 0
          ? response.data.items.map((it) => ({ ...it }))
          : [
              {
                sno: 1,
                particulars: response.data.particulars || 'Fresh Seafood / Prawns Supply',
                hsn: response.data.hsn || '0306',
                quantity: response.data.quantity,
                rate: response.data.rate,
                taxRate: '',
                amount: response.data.total,
              },
            ]
      );

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
      link.download = `Invoice-${bill.billNo}${bill.isVoided ? '-VOIDED' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast('Failed to download PDF', 'error');
    }
  };

  const handleShareWhatsApp = () => {
    if (!bill) return;

    const pdfUrl = billsAPI.getPDF(id);
    const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
    const amountStr = formatCurrency(bill.grandTotal || bill.total);
    const rawPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
    const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const message = `*VIJAYA DURGA AGENCIES*
*Tax Invoice #${bill.billNo}* ${bill.isVoided ? '*(VOIDED / CANCELLED)*' : ''}

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

  const handleUpdatePaymentStatus = async (newStatus) => {
    if (bill.isVoided) {
      showToast('Cannot change status of a voided invoice', 'error');
      return;
    }
    try {
      const response = await billsAPI.updatePaymentStatus(id, newStatus);
      setBill(response.data);
      showToast(`Invoice #${bill.billNo} payment status updated to ${newStatus}`);
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Void Invoice Handler
  const handleVoidInvoice = async () => {
    setVoiding(true);
    try {
      const res = await billsAPI.void(id, voidReason);
      setBill(res.data.bill);
      setShowVoidModal(false);
      showToast(`Invoice #${bill.billNo} marked as VOIDED`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to void invoice', 'error');
    } finally {
      setVoiding(false);
    }
  };

  // Edit Item Change Handler
  const handleEditItemChange = (index, field, value) => {
    const updated = [...editItems];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'rate') {
      const q = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const r = parseFloat(field === 'rate' ? value : updated[index].rate) || 0;
      updated[index].amount = Math.round(q * r * 100) / 100;
    }
    setEditItems(updated);
  };

  // Submit Edit Invoice
  const handleSaveEdit = async () => {
    if (!editCompanyName.trim()) {
      showToast('Customer / Company name is required', 'error');
      return;
    }
    const hasInvalid = editItems.some((it) => !it.quantity || parseFloat(it.quantity) <= 0 || !it.rate || parseFloat(it.rate) <= 0);
    if (hasInvalid) {
      showToast('Please enter valid Quantity (>0) and Price (>0) for all items', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const updatePayload = {
        companyName: editCompanyName.trim(),
        customerPhone: editCustomerPhone.replace(/\D/g, '').slice(0, 10),
        items: editItems,
      };
      const res = await billsAPI.update(id, updatePayload);
      setBill(res.data);
      setShowEditModal(false);
      showToast(`Invoice #${bill.billNo} updated successfully!`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update invoice', 'error');
    } finally {
      setSavingEdit(false);
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

  // Check if invoice is from today (for same-day edit rule)
  const isSameDay = new Date(bill.createdAt || bill.date).toDateString() === new Date().toDateString();
  const canEditBill = !bill.isVoided && (isSameDay || user?.role === 'admin' || user?.role === 'owner');

  // Empty grid lines to match authentic printed bill book
  const emptyRowsCount = Math.max(1, 6 - itemsList.length);

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Screen Header (Hidden during Print) */}
      <div className="bill-detail-header no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              Invoice <span style={{ color: bill.isVoided ? '#dc2626' : '#0b5394' }}>#{bill.billNo}</span>
            </h2>
            {bill.isVoided && (
              <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>
                ⛔ VOIDED / CANCELLED
              </span>
            )}
          </div>
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

          {!bill.isVoided && (
            <button
              className="btn btn-whatsapp"
              style={{ fontWeight: 700, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleShareWhatsApp}
              disabled={sharing}
            >
              <WhatsAppIcon size={18} color="#ffffff" /> WhatsApp
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '10px 14px' }}
            onClick={handleDownloadPDF}
          >
            <DownloadIcon size={16} /> PDF
          </button>

          {/* Edit Invoice Button (Same-day correction) */}
          {canEditBill && (
            <button
              className="btn btn-secondary"
              style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 600 }}
              onClick={() => setShowEditModal(true)}
              title="Edit customer, weights, or rates (same-day only)"
            >
              ✏️ Edit Bill
            </button>
          )}

          {/* Void Invoice Button */}
          {!bill.isVoided && canUpdateStatus && (
            <button
              className="btn btn-secondary"
              style={{ padding: '10px 14px', color: '#ef4444', border: '1px solid #fecaca', background: '#fff5f5', fontWeight: 700 }}
              onClick={() => setShowVoidModal(true)}
              title="Mark this bill as voided (keeps audit record)"
            >
              ⛔ Void Bill
            </button>
          )}

          {/* Admin Only: WhatsApp & SMS Payment Reminder Modal */}
          {isAdmin && !bill.isVoided && bill.paymentStatus !== 'Paid' && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ background: '#fef3c7', color: '#b45309', border: '1.5px solid #fde68a', fontWeight: 800, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setShowReminderModal(true)}
              title="Send formatted payment reminder via WhatsApp or SMS"
            >
              📢 Send Reminder
            </button>
          )}

          {/* Admin Only: Duplicate Bill */}
          {isAdmin && (
            <button
              className="btn btn-secondary"
              style={{ padding: '10px 14px', fontWeight: 700 }}
              onClick={() => navigate('/new-bill', { state: { cloneBill: bill } })}
              title="Duplicate this bill for a new invoice"
            >
              📋 Duplicate Bill
            </button>
          )}

          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bills')}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        </div>
      </div>

      {/* Void Notice Banner if bill is voided */}
      {bill.isVoided && (
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          color: '#991b1b',
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800 }}>
            ⛔ This invoice has been VOIDED
          </h4>
          <p style={{ margin: 0, fontSize: '0.86rem' }}>
            Reason: {bill.voidReason || 'No reason provided'} • Voided on: {formatDateTime(bill.voidedAt || bill.updatedAt)}
          </p>
        </div>
      )}

      {/* Screen Invoice Details Card (Hidden during Print) */}
      <div className="card no-print" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Invoice Details</h3>
          <span className={`badge ${bill.isVoided ? 'badge-amber' : bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
            {bill.isVoided ? 'VOIDED' : `Status: ${bill.paymentStatus || 'Pending'}`}
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
            <span className="detail-label">GSTIN</span>
            <span className="detail-value">{bill.companyGstin || 'Not Specified'}</span>
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
            <div className="invoice-total-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: bill.isVoided ? '#dc2626' : '#0b5394', textDecoration: bill.isVoided ? 'line-through' : 'none' }}>
              {formatCurrency(bill.grandTotal || bill.total)}
            </div>
          </div>
        </div>

        {/* Payment Status Toggle (Owner/Admin) */}
        {!bill.isVoided && canUpdateStatus && (
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
      <div className="official-invoice-frame" style={{ position: 'relative' }}>
        {/* Screen/Print VOID Watermark */}
        {bill.isVoided && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '10%',
            right: '10%',
            textAlign: 'center',
            transform: 'rotate(-30deg)',
            fontSize: '4.5rem',
            fontWeight: 900,
            color: 'rgba(220, 38, 38, 0.22)',
            border: '6px dashed rgba(220, 38, 38, 0.3)',
            padding: '16px 20px',
            pointerEvents: 'none',
            zIndex: 10,
            letterSpacing: '4px',
          }}>
            VOID / CANCELLED
          </div>
        )}

        <div style={{
          border: '1.5px solid #0b5394',
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: '0 auto',
          maxWidth: '800px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          opacity: bill.isVoided ? 0.75 : 1,
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

          {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS (Exact Reference Style) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1.5px solid #0b5394',
            padding: '8px 16px'
          }}>
            {/* Lord Ganesha on Left */}
            <div style={{ width: '60px', textAlign: 'left', flexShrink: 0 }}>
              <img
                src={ganeshaImg}
                alt="Lord Ganesha"
                style={{ width: '56px', height: '56px', objectFit: 'contain' }}
              />
            </div>

            {/* Center Company Details with Centered Durga Maa Emblem */}
            <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
              <img
                src={durgaImg}
                alt="Durga Maa"
                style={{ width: '32px', height: '32px', objectFit: 'contain', margin: '0 auto 2px auto', display: 'block' }}
              />
              <h1 style={{
                color: '#0b5394',
                fontSize: '1.65rem',
                fontWeight: 900,
                letterSpacing: '0.8px',
                margin: '0 0 2px 0',
                fontFamily: 'Arial, sans-serif'
              }}>
                VIJAYA DURGA AGENCIES
              </h1>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#000000', margin: '2px 0' }}>
                Prop: SATTINENI VENKATA DHANA LAXMI &nbsp;|&nbsp; GSTIN: {bill.companyGstin || '37KATPS1500Q1ZR'}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#000000', lineHeight: '1.25' }}>
                D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.
              </div>
            </div>

            {/* Ram Darbar on Right */}
            <div style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>
              <img
                src={ramDarbarImg}
                alt="Ram Darbar"
                style={{ width: '56px', height: '56px', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* 3. BILL NO & DATE ROW */}
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
              <span style={{ fontWeight: 'bold', color: '#000000' }}>{bill.companyGstin || ''}</span>
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
            </tbody>
          </table>

          {/* 7. ITEMS TOTAL ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 105px',
            borderTop: '1.5px solid #0b5394',
            borderBottom: '1.5px solid #0b5394',
            background: '#f0f5fa',
            fontSize: '0.85rem'
          }}>
            <div style={{ borderRight: '1.5px solid #0b5394', padding: '4px 10px', textAlign: 'right', fontWeight: 'bold', color: '#0b5394' }}>
              TOTAL
            </div>
            <div style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 900, color: '#000000' }}>
              {Number(bill.total || finalAmount).toFixed(2)}
            </div>
          </div>

          {/* 8. TAX BREAKDOWN TABLE */}
          <div style={{ borderBottom: '1.5px solid #0b5394' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
              background: '#e8f1f8',
              borderBottom: '1px solid #0b5394',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              color: '#0b5394',
              textAlign: 'center'
            }}>
              <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>Taxable Value</div>
              <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>CGST Tax</div>
              <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>SGST Tax</div>
              <div style={{ padding: '3px 2px' }}>IGST Tax</div>
            </div>

            {/* Sub-header for Rate/Amount */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.5fr 0.5fr 0.5fr 0.5fr 1fr',
              borderBottom: '1px solid #0b5394',
              fontSize: '0.68rem',
              textAlign: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ borderRight: '1px solid #0b5394' }}></div>
              <div style={{ borderRight: '1px solid #0b5394', color: '#0b5394', fontWeight: 'bold' }}>Rate</div>
              <div style={{ borderRight: '1px solid #0b5394', color: '#0b5394', fontWeight: 'bold' }}>Amount</div>
              <div style={{ borderRight: '1px solid #0b5394', color: '#0b5394', fontWeight: 'bold' }}>Rate</div>
              <div style={{ borderRight: '1px solid #0b5394', color: '#0b5394', fontWeight: 'bold' }}>Amount</div>
              <div style={{ color: '#0b5394', fontWeight: 'bold' }}>Amount</div>
            </div>

            {/* Tax Values */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.5fr 0.5fr 0.5fr 0.5fr 1fr',
              fontSize: '0.75rem',
              textAlign: 'center',
              height: '20px',
              alignItems: 'center'
            }}>
              <div style={{ borderRight: '1px solid #0b5394', fontWeight: 'bold' }}>{Number(bill.taxableValue || bill.total || finalAmount).toFixed(2)}</div>
              <div style={{ borderRight: '1px solid #0b5394' }}>{bill.cgstRate || '2.5'}</div>
              <div style={{ borderRight: '1px solid #0b5394' }}>{Number(bill.cgstAmount || 100).toFixed(2)}</div>
              <div style={{ borderRight: '1px solid #0b5394' }}>{bill.sgstRate || '2.5'}</div>
              <div style={{ borderRight: '1px solid #0b5394' }}>{Number(bill.sgstAmount || 100).toFixed(2)}</div>
              <div>{Number(bill.igstAmount || 100).toFixed(2)}</div>
            </div>
          </div>

          {/* 9. GRAND TOTAL HIGHLIGHT ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 125px',
            borderBottom: '1.5px solid #0b5394',
            background: '#e8f1f8',
            fontSize: '0.9rem'
          }}>
            <div style={{ borderRight: '1.5px solid #0b5394', padding: '5px 10px', textAlign: 'right', fontWeight: 900, color: '#0b5394' }}>
              GRAND TOTAL
            </div>
            <div style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 900, color: '#000000', fontSize: '0.95rem' }}>
              {Number(finalAmount).toFixed(2)}
            </div>
          </div>

          {/* 10. BANK PAYMENT DETAILS & SIGNATURE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            fontSize: '0.74rem',
            lineHeight: '1.4'
          }}>
            <div style={{ borderRight: '1.5px solid #0b5394', padding: '6px 10px' }}>
              <div style={{ fontWeight: 'bold', color: '#0b5394' }}>BANK : KARUR VYSYA BANK</div>
              <div>A/c. NO : <strong>4805135000002964</strong></div>
              <div>IFSC : <strong>KVBL0004815</strong></div>
              <div>Branch : Narasapur</div>
              <div style={{ fontSize: '0.62rem', color: '#555555', marginTop: '3px' }}>
                Goods once sold will not be taken back. Subject to local Jurisdiction.
              </div>
            </div>

            <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.78rem' }}>
                For VIJAYA DURGA AGENCIES
              </div>
              <div style={{ marginTop: '24px', borderTop: '1px solid #000000', paddingTop: '2px', fontWeight: 'bold', color: '#0b5394' }}>
                Proprietor
              </div>
            </div>
          </div>

        </div>

        {/* Amount in Words */}
        <div style={{
          maxWidth: '800px',
          margin: '6px auto 0 auto',
          fontSize: '0.78rem',
          color: '#000000'
        }}>
          <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Amount in Words: &nbsp;</span>
          <span style={{ fontWeight: 'bold' }}>{amountInWordsText}</span>
        </div>
      </div>

      {/* ── MODAL: EDIT INVOICE (Same-day Typo Correction) ── */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                ✏️ Edit Invoice #{bill.billNo}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Customer Name *</label>
              <input
                type="text"
                className="form-input"
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Customer Phone (10 digits)</label>
              <input
                type="tel"
                className="form-input"
                value={editCustomerPhone}
                onChange={(e) => setEditCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
              />
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.92rem', fontWeight: 700, color: '#0b5394' }}>
              Line Items (Correct Weights & Rates)
            </h4>
            {editItems.map((item, idx) => (
              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px', color: '#334155' }}>
                  Item #{idx + 1}: {item.particulars}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                      style={{ fontWeight: 700, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Price / Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={item.rate}
                      onChange={(e) => handleEditItemChange(idx, 'rate', e.target.value)}
                      style={{ fontWeight: 700, textAlign: 'right' }}
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#0b5394', marginTop: '6px' }}>
                  Subtotal: {formatCurrency(item.amount || (item.quantity * item.rate) || 0)}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', background: '#0b5394', fontWeight: 700 }}
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '12px 18px' }}
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VOID INVOICE CONFIRMATION ── */}
      {showVoidModal && (
        <div className="modal-backdrop" onClick={() => setShowVoidModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#fee2e2', color: '#dc2626', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                ⛔
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#991b1b' }}>
                Void Invoice #{bill.billNo}?
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
              Voiding this invoice will remove it from total sales and receivables. The bill number will remain in the database with a <strong>VOIDED</strong> audit record.
            </p>

            <div className="form-group" style={{ marginTop: '12px', marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Reason for Voiding (Optional):</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Duplicate entry, customer cancelled, wrong rate"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px', background: '#dc2626', color: '#ffffff', border: 'none', fontWeight: 700 }}
                onClick={handleVoidInvoice}
                disabled={voiding}
              >
                {voiding ? 'Voiding...' : 'Yes, Void This Invoice'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '12px 18px' }}
                onClick={() => setShowVoidModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Payment Reminder Modal */}
      {showReminderModal && (
        <ReminderModal
          billId={bill._id}
          onClose={() => setShowReminderModal(false)}
        />
      )}
    </div>
  );
}

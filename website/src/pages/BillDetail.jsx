import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { billsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, useToast, Toast, shareInvoicePDFOnWhatsApp } from '../utils/helpers';
import { PrintIcon, DownloadIcon, WhatsAppIcon, PlusIcon, ArrowLeftIcon, ShareIcon, EditIcon, TrashIcon } from '../components/Icons';
import ReminderModal from '../components/ReminderModal';
import PaymentModal from '../components/PaymentModal';
import ShareModal from '../components/ShareModal';
import OfficialInvoiceSheet from '../components/OfficialInvoiceSheet';
import { getOfflineBill, saveOfflineBill, getMasterCache, invalidateBillCaches } from '../utils/offlineDb';
import { flushSyncQueue } from '../services/syncManager';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import DeleteInvoiceModal from '../components/DeleteInvoiceModal';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const [bill, setBill] = useState(null);
  const [businessSettings, setBusinessSettings] = useState({ businessName: 'VIJAYA DURGA SEA FOODS' });
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);



  // Void Action State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Delete Action State (Admin/Owner only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canVoidBill = user?.role === 'admin' || user?.role === 'owner';
  const canDeleteBill = user?.role === 'admin' || user?.role === 'owner';
  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'owner' || user?.role === 'admin';
  const { lang, t } = useLanguage();
  const autoprintTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadBill();
    loadSettings();

    const handleSyncComplete = () => {
      if (isMountedRef.current) loadBill();
    };
    window.addEventListener('vda-sync-completed', handleSyncComplete);

    return () => {
      isMountedRef.current = false;
      if (autoprintTimerRef.current) clearTimeout(autoprintTimerRef.current);
      window.removeEventListener('vda-sync-completed', handleSyncComplete);
    };
  }, [id]);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data && isMountedRef.current) {
        setBusinessSettings(response.data);
      }
    } catch (error) {
      try {
        const cached = await getMasterCache('settings');
        if (cached && isMountedRef.current) setBusinessSettings(cached);
      } catch (e) {}
      if (import.meta.env.DEV) { console.error('Failed to load settings:', error); }
    }
  };

  const checkAutoprint = () => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('autoprint') === 'true') {
      if (autoprintTimerRef.current) clearTimeout(autoprintTimerRef.current);
      autoprintTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          if (id && !String(id).startsWith('offline_')) {
            billsAPI.markPrinted(id).catch(() => {});
          }
          window.print();
        }
      }, 450);
    }
  };

  const loadBill = async () => {
    try {
      if (id && id.startsWith('offline_')) {
        const offlineData = await getOfflineBill(id);
        if (offlineData && isMountedRef.current) {
          setBill(offlineData);
          checkAutoprint();
          setLoading(false);
          return;
        }
      }

      const response = await billsAPI.getById(id);
      if (isMountedRef.current) {
        setBill(response.data);
        saveOfflineBill({ ...response.data, isOffline: false, synced: true }).catch(() => {});
        checkAutoprint();
      }
    } catch (error) {
      try {
        const cached = await getOfflineBill(id);
        if (cached && isMountedRef.current) {
          setBill(cached);
          checkAutoprint();
          setLoading(false);
          return;
        }
      } catch (e) {}
      if (import.meta.env.DEV) { console.error('Failed to load invoice:', error); }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleManualSync = async () => {
    showToast('Syncing offline invoice to MongoDB Atlas cloud...', 'info');
    const result = await flushSyncQueue();
    if (result.synced > 0) {
      showToast('Successfully synced to MongoDB Atlas', 'success');
      loadBill();
    } else {
      showToast('Could not connect to MongoDB Atlas. Retrying when signal strengthens.', 'error');
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
    if (bill?._id && !String(bill._id).startsWith('offline_')) {
      billsAPI.markPrinted(bill._id).catch(() => {});
    }
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    showToast('Generating official PDF...', 'info');
    try {
      const response = await billsAPI.getPDFBlob(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${bill.formattedBillNo || bill.billNo}${bill.isVoided ? '-VOIDED' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('PDF downloaded successfully', 'success');
    } catch (error) {
      if (import.meta.env.DEV) { console.error('PDF error:', error); }
      showToast('Failed to download PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!bill) return;
    setSharing(true);
    try {
      await shareInvoicePDFOnWhatsApp(bill, showToast);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('WhatsApp share error:', err); }
    } finally {
      setSharing(false);
    }
  };

  const handleUpdatePaymentStatus = async (newStatus) => {
    if (!bill || bill.isVoided) {
      showToast('Cannot change status of a voided invoice', 'error');
      return;
    }
    if (bill.paymentStatus === newStatus) return;

    setUpdatingStatus(true);
    try {
      const response = await billsAPI.updatePaymentStatus(id, newStatus);
      setBill(response.data);
      invalidateBillCaches('payment').catch(() => {});
      showToast(`Invoice #${bill.billNo} marked as ${newStatus}`);
    } catch (error) {
      if (import.meta.env.DEV) { console.error('Failed to update status:', error); }
      showToast(error.response?.data?.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Void Invoice Handler
  const handleVoidInvoice = async () => {
    setVoiding(true);
    try {
      const res = await billsAPI.void(id, voidReason);
      setBill(res.data.bill);
      setShowVoidModal(false);
      invalidateBillCaches('void').catch(() => {});
      showToast(
        lang === 'te'
          ? `ఇన్‌వాయిస్ #${bill.billNo} రద్దు చేయబడింది`
          : `Invoice #${bill.billNo} marked as VOIDED`,
        'success'
      );
    } catch (err) {
      showToast(err.response?.data?.message || (lang === 'te' ? 'ఇన్‌వాయిస్ రద్దు విఫలమైంది' : 'Failed to void invoice'), 'error');
    } finally {
      setVoiding(false);
    }
  };

  // Delete Invoice Handler (Admin Only)
  const handleDeleteInvoice = async ({ confirmationCode, reason }) => {
    setDeleting(true);
    try {
      const res = await billsAPI.delete(id, confirmationCode, reason);
      invalidateBillCaches('delete').catch(() => {});
      showToast(
        res.data?.message ||
          (lang === 'te'
            ? `ఇన్‌వాయిస్ #${bill.billNo} విజయవంతంగా తొలగించబడింది.`
            : `Invoice #${bill.billNo} deleted successfully. Next invoice will be #${res.data?.nextInvoiceNo || bill.billNo}.`),
        'success'
      );
      setShowDeleteModal(false);
      navigate('/bills');
    } catch (err) {
      showToast(err.response?.data?.message || (lang === 'te' ? 'ఇన్‌వాయిస్ తొలగింపు విఫలమైంది' : 'Failed to delete invoice'), 'error');
    } finally {
      setDeleting(false);
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
    count: bill.count || '',
    particulars: bill.particulars || 'Fresh Seafood / Prawns Supply',
    hsn: bill.hsn || '0306',
    quantity: bill.quantity,
    rate: bill.rate,
    taxRate: '',
    amount: bill.total,
  }];

  // Check if invoice is from today (for same-day edit rule)
  const isSameDay = new Date(bill.createdAt || bill.date).toDateString() === new Date().toDateString();
  const canEditBill = !bill.isVoided && (isSameDay || user?.role === 'admin' || user?.role === 'owner');

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Screen Header (Hidden during Print) */}
      <div className="bill-detail-header no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              Invoice <span className="tabular-num" style={{ color: bill.isVoided ? '#b42318' : '#0b5394' }}>#{bill.billNo}</span>
            </h1>
            {bill.isVoided && (
              <span className="badge" style={{ background: '#fee2e2', color: '#b42318', fontWeight: 700, fontSize: '0.85rem' }}>
                VOIDED / CANCELLED
              </span>
            )}
            {bill.isOffline && (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.82rem', border: '1px solid #fcd34d' }}>
                SHED MODE VOUCHER
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.85rem' }}>
            {formatDateTime(bill.date)}
          </p>
        </div>

        {/* ── Desktop action buttons (hidden on phone) ── */}
        <div className="action-buttons hide-on-phone" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
              style={{ fontWeight: 700, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleShareWhatsApp}
              disabled={sharing}
            >
              <WhatsAppIcon size={18} color="#ffffff" /> WhatsApp
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '85px', justifyContent: 'center' }}
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <><span className="btn-spinner" style={{ width: '13px', height: '13px' }}></span> PDF...</>
            ) : (
              <><DownloadIcon size={16} /> PDF</>
            )}
          </button>

          {canEditBill && (
            <button
              className="btn btn-secondary"
              style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 600 }}
              onClick={() => navigate('/new-bill', { state: { editBill: bill } })}
            >
              Edit Bill
            </button>
          )}

          {canDeleteBill && (
            <button
              className="btn btn-secondary"
              style={{ padding: '10px 14px', color: '#dc2626', border: '1px solid #fecaca', background: '#fff5f5', fontWeight: 700 }}
              onClick={() => setShowDeleteModal(true)}
            >
              {lang === 'te' ? 'బిల్లు తొలగించు' : 'Delete Bill'}
            </button>
          )}

          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bills')}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        </div>

        {/* ── Mobile action buttons (phone only) ── */}
        <div className="mobile-only-actions" style={{ display: 'none' }}>
          {/* Primary row: WhatsApp full-width + Print icon */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            {!bill.isVoided && (
              <button
                className="btn btn-whatsapp"
                style={{ flex: 1, fontWeight: 700, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem' }}
                onClick={handleShareWhatsApp}
                disabled={sharing}
              >
                <WhatsAppIcon size={20} color="#ffffff" /> WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              style={{ width: '48px', height: '48px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              title="Download PDF"
            >
              {downloadingPdf ? <span className="btn-spinner" style={{ width: '14px', height: '14px' }} /> : <DownloadIcon size={18} color="#334155" />}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{ width: '48px', height: '48px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              title="Print Invoice"
            >
              <PrintIcon size={18} color="#0b5394" />
            </button>
          </div>

          {/* Secondary row: only Edit and Delete buttons */}
          {(canEditBill || canDeleteBill) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {canEditBill && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, fontWeight: 600, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => navigate('/new-bill', { state: { editBill: bill } })}
                >
                  <EditIcon size={15} /> Edit
                </button>
              )}
              {canDeleteBill && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, color: '#b42318', border: '1px solid #fecaca', background: '#fff5f5', fontWeight: 600, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setShowDeleteModal(true)}
                >
                  <TrashIcon size={15} color="#b42318" /> Delete
                </button>
              )}
            </div>
          )}

          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }} onClick={() => navigate('/bills')}>
            <ArrowLeftIcon size={16} /> Back
          </button>
        </div>
      </div>

      {/* Shed Mode Offline Voucher Notice */}
      {bill.isOffline && (
        <div
          className="no-print"
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1.5px solid #fde68a',
            borderRadius: '12px',
            padding: '14px 20px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>
                Shed Mode Offline Voucher (#{bill.billNo})
              </div>
              <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '2px' }}>
                Saved in local browser memory. Thermal slip and A4 bill are 100% printable. Will automatically sync to MongoDB Atlas when data connects.
              </div>
            </div>
          </div>
          {typeof navigator !== 'undefined' && navigator.onLine && (
            <button
              className="btn btn-primary"
              onClick={handleManualSync}
              style={{
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '8px 16px',
                background: '#d97706',
                border: 'none',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
              }}
            >
              Sync to Atlas Cloud Now
            </button>
          )}
        </div>
      )}

      {/* Payment Settlement Card (if not voided) */}
      {!bill.isVoided && (
        <div
          className="no-print"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Invoice Total
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                {formatCurrency(bill.grandTotal || bill.total)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Paid Amount
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>
                {formatCurrency(bill.paidAmount || (bill.paymentStatus === 'Paid' ? (bill.grandTotal || bill.total) : 0))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                Balance Due
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                {formatCurrency(Math.max(0, (bill.grandTotal || bill.total) - (bill.paidAmount || (bill.paymentStatus === 'Paid' ? (bill.grandTotal || bill.total) : 0))))}
              </div>
            </div>

            <div>
              <span
                className={`badge ${
                  bill.paymentStatus === 'Paid'
                    ? 'badge-green'
                    : bill.paymentStatus === 'Partial'
                    ? 'badge-blue'
                    : 'badge-amber'
                }`}
                style={{ fontSize: '0.8rem', fontWeight: 800, padding: '4px 10px' }}
              >
                {bill.paymentStatus}
              </span>
            </div>
          </div>

          {canUpdateStatus && bill.paymentStatus !== 'Paid' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowPaymentModal(true)}
              style={{ background: '#16a34a', color: '#ffffff', fontWeight: 800, padding: '8px 16px' }}
            >
              + Record Payment
            </button>
          )}
        </div>
      )}

      {/* Void Notice Banner if bill is voided */}
      {bill.isVoided && (
        <div
          className="no-print"
          style={{
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Items Breakdown
          </h4>
          <span className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'none' }}>
            ← Scroll horizontally to view details →
          </span>
        </div>
        <div
          className="table-container items-breakdown-container"
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            marginBottom: '20px',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          <table className="table" style={{ margin: 0, minWidth: '600px', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                <th style={{ minWidth: '130px' }}>PARTICULARS</th>
                <th style={{ width: '90px', textAlign: 'center' }}>COUNT</th>
                <th style={{ width: '110px', textAlign: 'right' }}>QTY (KG)</th>
                <th style={{ width: '110px', textAlign: 'right' }}>PRICE (₹)</th>
                {canSeeSales && <th style={{ width: '120px', textAlign: 'right' }}>AMOUNT (₹)</th>}
              </tr>
            </thead>
            <tbody>
              {itemsList.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.sno || index + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.particulars}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.count ? String(item.count) : (item.particulars === 'Ice' ? 'Ice' : '—')}</td>
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
        <div className="invoice-total-section print-keep-together">
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
                style={bill.paymentStatus === 'Paid' ? { background: '#16a34a', color: '#ffffff' } : {}}
                onClick={() => handleUpdatePaymentStatus('Paid')}
                disabled={updatingStatus || bill.paymentStatus === 'Paid'}
              >
                {updatingStatus && bill.paymentStatus !== 'Paid' ? 'Updating...' : 'Mark as Paid'}
              </button>
              <button
                className={`btn btn-sm ${bill.paymentStatus !== 'Paid' ? 'btn-primary' : 'btn-secondary'}`}
                style={bill.paymentStatus !== 'Paid' ? { background: '#d97706', color: '#ffffff' } : {}}
                onClick={() => handleUpdatePaymentStatus('Pending')}
                disabled={updatingStatus || bill.paymentStatus === 'Pending'}
              >
                {updatingStatus && bill.paymentStatus === 'Paid' ? 'Updating...' : 'Mark as Pending'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          OFFICIAL INVOICE TEMPLATE (Shared with PublicInvoice)
          Visible on screen preview & during window.print()
      ══════════════════════════════════════════════════════════════════════════ */}
      <OfficialInvoiceSheet
        bill={bill}
        businessSettings={businessSettings}
        watermarkText="VOID / CANCELLED"
      />



      {/* ── MODAL: VOID INVOICE CONFIRMATION ── */}
      <ConfirmModal
        isOpen={showVoidModal}
        customIcon={<span style={{ fontSize: '1.3rem', lineHeight: 1 }}>⛔</span>}
        title={lang === 'te' ? `ఇన్‌వాయిస్ #${bill.billNo} రద్దు చేయాలా?` : `Void Invoice #${bill.billNo}?`}
        subtitle={lang === 'te' ? 'నిర్ధారణ అవసరం' : 'Confirmation Required'}
        message={
          lang === 'te'
            ? 'ఈ ఇన్‌వాయిస్‌ను ఖచ్చితంగా రద్దు చేయాలనుకుంటున్నారా? ఇది వ్యాపార విక్రయాల గణాంకాలు మరియు కస్టమర్ బ్యాలెన్స్ నుండి తొలగించబడుతుంది.'
            : 'Are you sure you want to void this invoice? Voiding will permanently cancel the bill and adjust customer receivables.'
        }
        itemDetails={[
          { label: lang === 'te' ? 'ఇన్‌వాయిస్ నం' : 'Invoice #', value: `#${bill.billNo}`, isMono: true },
          { label: lang === 'te' ? 'కస్టమర్ పేరు' : 'Customer', value: bill.customerName || '—' },
          { label: lang === 'te' ? 'తేదీ' : 'Date', value: formatDateTime(bill.date) },
          { label: lang === 'te' ? 'మొత్తం బిల్లు' : 'Total Amount', value: formatCurrency(bill.total), isMono: true },
          { label: lang === 'te' ? 'చెల్లింపు స్థితి' : 'Status', value: bill.paymentStatus || 'Pending' },
        ]}
        warningText={
          lang === 'te'
            ? 'ఈ చర్య శాశ్వతమైనది. ఆడిట్ రికార్డుల కోసం బిల్లు సంఖ్య డేటాబేస్‌లో VOIDED స్థితితో భద్రపరచబడుతుంది మరియు మార్చలేరు.'
            : 'This action is permanent. The bill number will remain in the system with an immutable VOIDED audit record.'
        }
        confirmText={lang === 'te' ? 'అవును, బిల్లు రద్దు చేయి' : 'Yes, Void Invoice'}
        cancelText={lang === 'te' ? 'రద్దు చేయి' : 'Cancel'}
        confirmType="danger"
        loading={voiding}
        confirmLoadingText={lang === 'te' ? 'రద్దు చేస్తోంది...' : 'Voiding...'}
        onConfirm={handleVoidInvoice}
        onClose={() => {
          if (!voiding) {
            setShowVoidModal(false);
          }
        }}
      >
        <div className="form-group" style={{ marginTop: '4px' }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {lang === 'te' ? 'రద్దు చేయడానికి కారణం (ఐచ్ఛికం):' : 'Reason for Voiding (Optional):'}
          </label>
          <input
            type="text"
            className="form-input"
            placeholder={
              lang === 'te'
                ? 'ఉదా. తప్పుడు ఎంట్రీ, కస్టమర్ రద్దు చేశారు...'
                : 'e.g. Duplicate entry, customer cancelled, wrong rate'
            }
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          />
        </div>
      </ConfirmModal>

      {/* ── MODAL: DELETE INVOICE WITH SECURITY CODE ── */}
      <DeleteInvoiceModal
        isOpen={showDeleteModal}
        bill={bill}
        loading={deleting}
        lang={lang}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteInvoice}
      />

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          billId={bill._id}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(msg) => {
            showToast(msg);
            loadBill();
          }}
        />
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

import { useState } from 'react';
import { DownloadIcon, WhatsAppIcon, ShareIcon } from './Icons';
import { formatCurrency } from '../utils/helpers';

export default function ShareModal({ bill, onClose, showToast }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!bill) return null;

  const origin = window.location.origin;
  const publicUrl = `${origin}/view/${bill._id}`;
  const pdfUrl = `${origin}/api/bills/${bill._id}/pdf`;
  const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
  const amountStr = formatCurrency(bill.grandTotal || bill.total);
  const rawPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
  const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

  // 1. Native System Share (WhatsApp, Gmail, Messages, AirDrop, etc.)
  const handleSystemShare = async () => {
    try {
      if (showToast) showToast('Preparing Invoice PDF for share...');
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const blob = await response.blob();
      const fileName = `VIJAYA_DURGA_INVOICE_${bill.billNo}.pdf`;
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Tax Invoice #${bill.billNo} - VIJAYA DURGA AGENCIES`,
        });
        if (showToast) showToast('Invoice shared successfully!');
        onClose();
        return;
      }
    } catch (err) {
      console.warn('System share skipped or cancelled:', err);
    }
    // If not supported, download PDF
    handleDownloadPDF();
  };

  // 2. Download PDF Document
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const fileBlobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileBlobUrl;
      link.download = `VIJAYA_DURGA_INVOICE_${bill.billNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileBlobUrl);
      if (showToast) showToast('Invoice PDF downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      window.open(pdfUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  // 3. WhatsApp Direct Message
  const handleWhatsApp = () => {
    const text = `*VIJAYA DURGA AGENCIES*\nTax Invoice #${bill.billNo} ${bill.isVoided ? '(VOIDED)' : ''}\n\nCustomer: ${bill.companyName}\nDate: ${formattedDate}\nTotal Amount: ${amountStr}\n\nView Official Invoice:\n${publicUrl}\n\nThank you for your business!`;
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    if (showToast) showToast('Opening WhatsApp...');
  };

  // 4. Email (Gmail / Mail App)
  const handleEmail = () => {
    const subject = `Tax Invoice #${bill.billNo} from VIJAYA DURGA AGENCIES`;
    const body = `Dear ${bill.companyName},\n\nPlease find your tax invoice details below:\n\nInvoice Number: #${bill.billNo}\nInvoice Date: ${formattedDate}\nTotal Amount: ${amountStr}\n\nView Official Invoice:\n${publicUrl}\n\nThank you for your business!\nVIJAYA DURGA AGENCIES\nPhone: +91 9441429745`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // 5. Copy Link to Clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    if (showToast) showToast('Invoice link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
              Share Tax Invoice
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Invoice #{bill.billNo} • {bill.companyName} • {amountStr}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* Share Options Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          {/* Option 1: System / Native Apps Share */}
          <button
            type="button"
            onClick={handleSystemShare}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 12px',
              borderRadius: '12px',
              border: '1.5px solid #0b5394',
              background: '#eff6ff',
              color: '#0b5394',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.84rem',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShareIcon size={22} color="#0b5394" />
            <span>Send File (Apps)</span>
          </button>

          {/* Option 2: WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 12px',
              borderRadius: '12px',
              border: '1.5px solid #16a34a',
              background: '#f0fdf4',
              color: '#16a34a',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.84rem',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <WhatsAppIcon size={22} color="#16a34a" />
            <span>WhatsApp Chat</span>
          </button>

          {/* Option 3: Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 12px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <DownloadIcon size={22} color="#334155" />
            <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
          </button>

          {/* Option 4: Email */}
          <button
            type="button"
            onClick={handleEmail}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 12px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '1.35rem' }}>✉️</span>
            <span>Send Email</span>
          </button>
        </div>

        {/* Copy Public Link Bar */}
        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {publicUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: copied ? '#16a34a' : '#0b5394',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

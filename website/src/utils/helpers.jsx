import { useState, useEffect, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return { toast, showToast, hideToast };
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className={`toast ${toast.type}`} onClick={onClose}>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}

export function formatCurrency(amount) {
  return `₹ ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Export Invoices to CSV formatted for CA / GST Filing
 */
export function exportBillsToCSV(bills, filename = 'GST_Invoices_Report.csv') {
  if (!bills || bills.length === 0) return false;

  const headers = [
    'Invoice No',
    'Invoice Date',
    'Customer Name (M/s)',
    'Customer GSTIN',
    'Customer Phone',
    'HSN Code',
    'Description',
    'Quantity (KG)',
    'Unit Rate (₹)',
    'Taxable Value (₹)',
    'CGST Rate',
    'CGST Amount (₹)',
    'SGST Rate',
    'SGST Amount (₹)',
    'IGST Amount (₹)',
    'Total Amount (₹)',
    'Payment Status',
  ];

  const escapeField = (text) => {
    if (text === null || text === undefined) return '""';
    const str = String(text).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [];
  bills.forEach((b) => {
    const d = new Date(b.date);
    const dateFormatted = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    const items = b.items && b.items.length > 0 ? b.items : [{
      particulars: b.particulars || 'Fresh Seafood / Prawns Supply',
      hsn: b.hsn || '0306',
      quantity: b.quantity,
      rate: b.rate,
      amount: b.total,
    }];

    items.forEach((it, idx) => {
      rows.push([
        escapeField(b.billNo),
        escapeField(dateFormatted),
        escapeField(b.companyName),
        escapeField(b.companyGstin || '37KATPS1500Q1ZR'),
        escapeField(b.customerPhone || ''),
        escapeField(it.hsn || '0306'),
        escapeField(it.particulars || 'Fresh Seafood / Prawns Supply'),
        escapeField(it.quantity || 0),
        escapeField(it.rate || 0),
        escapeField(idx === 0 ? (b.taxableValue || b.total) : it.amount),
        escapeField(idx === 0 ? (b.cgstRate || '') : ''),
        escapeField(idx === 0 ? (b.cgstAmount || 0) : 0),
        escapeField(idx === 0 ? (b.sgstRate || '') : ''),
        escapeField(idx === 0 ? (b.sgstAmount || 0) : 0),
        escapeField(idx === 0 ? (b.igstAmount || 0) : 0),
        escapeField(idx === 0 ? (b.grandTotal || b.total) : it.amount),
        escapeField(b.paymentStatus || 'Pending'),
      ].join(','));
    });
  });

  const csvContent = '\uFEFF' + [headers.map(escapeField).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function numberToWords(num) {
  if (!num || num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelow1000(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  }

  const intPart = Math.floor(num);
  const parts = [];

  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const remainder = intPart % 1000;

  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertBelow1000(remainder));

  return parts.join(' ') + ' Rupees Only';
}

/**
 * Share Tax Invoice PDF directly as an attachment to WhatsApp
 */
export async function shareInvoicePDFOnWhatsApp(bill, showToast) {
  if (!bill) return;

  const pdfUrl = `${window.location.origin}/api/bills/${bill._id}/pdf?token=${localStorage.getItem('srsf_token')}`;
  const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
  const amountStr = formatCurrency(bill.grandTotal || bill.total);
  const rawPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
  const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

  const caption = `VIJAYA DURGA AGENCIES
Tax Invoice #${bill.billNo} ${bill.isVoided ? '(VOIDED)' : ''}
📅 Date: ${formattedDate}
💰 Total: ${amountStr}

Thank you for your business!`;

  if (showToast) showToast('Preparing Invoice PDF for WhatsApp...');

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error('PDF fetch failed');
    const blob = await response.blob();
    const fileName = `Invoice-${bill.billNo}.pdf`;
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

    // Try Native Web Share API with real PDF Attachment (Mobile Android/iOS/Mac)
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `Invoice-${bill.billNo}.pdf`,
        text: caption,
      });
      if (showToast) showToast('Invoice PDF shared successfully!');
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('Native file share skipped/cancelled:', err);
  }

  // Fallback for Desktop browsers / Direct WhatsApp:
  // 1. Download the PDF file to user's computer
  try {
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const fileBlobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileBlobUrl;
    link.download = `Invoice-${bill.billNo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(fileBlobUrl);
  } catch (e) {
    console.error('Download fallback error:', e);
  }

  if (showToast) showToast('Invoice PDF downloaded! Opening WhatsApp to attach and send.');

  // 2. Open WhatsApp chat directly without creating blank Safari popup tab
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(caption)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;

  window.location.href = waUrl;
}




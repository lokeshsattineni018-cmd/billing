import React, { useRef, useEffect, useState } from 'react';
import { PrintIcon, WhatsAppIcon, ArrowLeftIcon, DownloadIcon } from './Icons';
import { formatDate, numberToWords } from '../utils/helpers';
import { staffAPI } from '../services/api';
import ganeshaImg from '../assets/ganesha.jpg';
import durgaImg from '../assets/durga.jpg';
import ramDarbarImg from '../assets/ram_darbar.jpg';

export default function VoucherBillModal({
  isOpen,
  onClose,
  type = 'worker', // 'worker' | 'ice' | 'statement'
  data,
  voucherNo,
}) {
  const printAreaRef = useRef(null);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const resolvedVoucherNo =
    voucherNo ||
    data.voucherNo ||
    (type === 'ice'
      ? 'ICE-1'
      : type === 'worker'
      ? 'WB-1'
      : `STMT-${data.workerName || 'ALL'}`);

  const handlePrint = () => {
    const printArea = printAreaRef.current;
    if (!printArea) return;

    let iframe = document.getElementById('voucher-silent-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'voucher-silent-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const title =
      type === 'ice'
        ? `Ice Bill ${resolvedVoucherNo}`
        : type === 'worker'
        ? `Worker Bill ${resolvedVoucherNo}`
        : `Worker Statement - ${data.workerName || 'Worker'}`;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${title}</title>`);
    doc.write(`<style>
      @page { size: A4 portrait; margin: 8mm; }
      body { margin: 0; padding: 12px; font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { box-sizing: border-box; }
      table { border-collapse: collapse; }
    </style>`);
    doc.write('</head><body>');
    doc.write(printArea.innerHTML);
    doc.write('</body></html>');
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    const cleanNo = resolvedVoucherNo.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${type === 'ice' ? 'IceBill' : type === 'worker' ? 'WorkerBill' : 'WorkerStatement'}-${cleanNo}.pdf`;
    try {
      const res = await staffAPI.getVoucherPDF({
        type,
        data,
        voucherNo: resolvedVoucherNo,
      });
      const fileBlobUrl = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = fileBlobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileBlobUrl);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('PDF download error:', err);
      }
      alert('Could not download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    if (sharingPdf) return;
    setSharingPdf(true);

    const cleanNo = resolvedVoucherNo.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${type === 'ice' ? 'IceBill' : type === 'worker' ? 'WorkerBill' : 'WorkerStatement'}-${cleanNo}.pdf`;

    let caption = '';
    let cleanPhone = '';

    if (type === 'ice') {
      const dateStr = formatDate(data.date);
      const from = data.iceFrom || data.supplierName || 'Sri Rama Ice Plant';
      const to = data.iceTo || 'Factory / Cold Storage';
      caption = `*VIJAYA DURGA SEA FOODS*
*ICE BILL: ${resolvedVoucherNo}*
📅 *Date:* ${dateStr}
🏢 *From (Supplier):* ${from}
🏭 *To (Receiver):* ${to}
🧊 *Item:* ICE
📦 *Quantity:* ${data.blocks} blocks
💵 *Rate:* ₹${Number(data.rate).toFixed(2)} / block
💰 *TOTAL AMOUNT:* ₹${Number(data.totalAmount).toFixed(2)}
🏷️ *Payment Status:* ${data.paymentStatus || 'Paid'}

Thank you!`;
    } else if (type === 'worker') {
      const dateStr = formatDate(data.date);
      const phone = data.staffPhone ? data.staffPhone.replace(/[^0-9]/g, '') : '';
      cleanPhone = phone.length === 10 ? '91' + phone : phone;
      caption = `*VIJAYA DURGA SEA FOODS*
*WORKER BILL: ${resolvedVoucherNo}*
👤 *Worker Name:* ${data.staffName}
📅 *Date:* ${dateStr}
💼 *Work & Shift:* ${data.workType || 'Processing'} (${data.shift || 'Full Day'})
⚖️ *Weight:* ${data.quantity} kg
💵 *Rate:* ₹${Number(data.price).toFixed(2)} / kg
💰 *TOTAL WAGE AMOUNT:* ₹${Number(data.totalAmount).toFixed(2)}
🏷️ *Payment Status:* ${data.paymentStatus || 'Pending'}

Thank you!`;
    } else if (type === 'statement') {
      const phone = data.summary?.staffPhone ? data.summary.staffPhone.replace(/[^0-9]/g, '') : '';
      cleanPhone = phone.length === 10 ? '91' + phone : phone;
      caption = `*VIJAYA DURGA SEA FOODS*
*WORKER WAGE STATEMENT & SETTLEMENT BILL*
👤 *Worker Name:* ${data.workerName}
📅 *Date:* ${formatDate(new Date())}
🗓️ *Days Worked:* ${data.summary?.daysWorkedCount || data.entries?.length || 0} days
⚖️ *Total Weight Processed:* ${data.summary?.totalKg || 0} kg
💰 *Total Wages Earned:* ₹${Number(data.summary?.totalEarned || 0).toFixed(2)}
💵 *Total Paid:* ₹${Number(data.summary?.totalPaid || 0).toFixed(2)}
⏳ *Pending Balance Due:* ₹${Number(data.summary?.pendingBalance || 0).toFixed(2)}

Thank you!`;
    }

    try {
      // 1. Fetch generated PDF blob from backend
      const res = await staffAPI.getVoucherPDF({
        type,
        data,
        voucherNo: resolvedVoucherNo,
      });

      const blob = res.data;
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

      // 2. Try Native Web Share API with real PDF Attachment (Mobile iOS/Android/Mac)
      // Directly opens share sheet with PDF document icon & WhatsApp action
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: fileName,
          text: caption,
        });
        setSharingPdf(false);
        return;
      }

      // 3. Fallback for Desktop browsers without direct file sharing:
      // Download the PDF file directly to user device
      const fileBlobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileBlobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileBlobUrl);

      // Open WhatsApp to send caption & attach downloaded PDF
      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(caption)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;

      window.location.href = waUrl;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled native share sheet
        setSharingPdf(false);
        return;
      }
      if (import.meta.env.DEV) {
        console.warn('PDF share failed, falling back to direct link:', err);
      }
      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(caption)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;
      window.location.href = waUrl;
    } finally {
      setSharingPdf(false);
    }
  };

  const modalTitle =
    type === 'ice' ? 'Ice Bill' : type === 'worker' ? 'Worker Bill' : 'Worker Wage Statement';
  const paymentStatus = data.paymentStatus || (type === 'statement' ? (data.summary?.pendingBalance > 0 ? 'Pending' : 'Settled') : 'Paid');
  const isPaid = paymentStatus === 'Paid' || paymentStatus === 'Settled';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          background: '#f8fafc',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          margin: '20px auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP ACTION HEADER (LIKE NORMAL BILL PAGE) ── */}
        <div
          className="bill-detail-header no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontWeight: 700 }}
            >
              <ArrowLeftIcon size={16} /> Back
            </button>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.35rem',
                fontWeight: 800,
                margin: 0,
                color: '#0f172a',
              }}
            >
              {modalTitle} <span style={{ color: '#0b5394' }}>{resolvedVoucherNo}</span>
            </h2>
            <span
              className={`badge ${isPaid ? 'badge-green' : 'badge-amber'}`}
              style={{ fontWeight: 800, fontSize: '0.8rem', padding: '4px 8px' }}
            >
              {paymentStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-whatsapp"
              disabled={sharingPdf}
              style={{
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                opacity: sharingPdf ? 0.75 : 1,
                cursor: sharingPdf ? 'wait' : 'pointer',
              }}
              onClick={handleWhatsApp}
            >
              <WhatsAppIcon size={18} color="#ffffff" />
              {sharingPdf ? 'Preparing PDF...' : 'Share WhatsApp'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={downloadingPdf}
              style={{
                fontWeight: 700,
                padding: '9px 14px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                opacity: downloadingPdf ? 0.75 : 1,
                cursor: downloadingPdf ? 'wait' : 'pointer',
              }}
              onClick={handleDownloadPDF}
              title="Download PDF"
            >
              <DownloadIcon size={16} color="#334155" />
              {downloadingPdf ? 'Downloading...' : 'PDF'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontWeight: 800,
                padding: '9px 16px',
                background: '#ffffff',
                border: '1.5px solid #0b5394',
                color: '#0b5394',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                fontSize: '0.9rem',
              }}
              onClick={handlePrint}
              title="Print Bill (Ctrl + P)"
            >
              <PrintIcon size={18} color="#0b5394" /> Print Bill
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{
                fontWeight: 700,
                padding: '9px 12px',
                fontSize: '1.1rem',
                color: '#64748b',
              }}
              title="Close Viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── THE OFFICIAL INVOICE PAPER (CENTERED DOCUMENT) ── */}
        <div
          ref={printAreaRef}
          style={{
            background: '#ffffff',
            border: '1.5px solid #0b5394',
            color: '#000000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            maxWidth: '800px',
            margin: '0 auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* 1. TOP BAR */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1.5px solid #0b5394',
              padding: '5px 12px',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              color: '#0b5394',
            }}
          >
            <div style={{ letterSpacing: '0.5px' }}>
              {type === 'ice'
                ? 'ICE BILL'
                : type === 'worker'
                ? 'WORKER BILL'
                : 'WORKER WAGE STATEMENT & SETTLEMENT BILL'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '1px' }}>
              ॥ జై శ్రీరామ్ ॥
            </div>
            <div>Cell: 9441429745</div>
          </div>

          {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid #0b5394',
              padding: '8px 16px',
            }}
          >
            <div style={{ width: '84px', textAlign: 'left', flexShrink: 0 }}>
              <img
                src={ganeshaImg}
                alt="Lord Ganesha"
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
              <img
                src={durgaImg}
                alt="Durga Maa"
                style={{ width: '52px', height: '52px', objectFit: 'contain', margin: '0 auto 2px auto', display: 'block' }}
              />
              <h1
                style={{
                  color: '#0b5394',
                  fontSize: '1.55rem',
                  fontWeight: 900,
                  letterSpacing: '0.8px',
                  margin: '0 0 2px 0',
                  fontFamily: 'Arial, sans-serif',
                }}
              >
                VIJAYA DURGA SEA FOODS
              </h1>
              <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#000000', margin: '2px 0' }}>
                Prop: SATTINENI VENKATA DHANA LAXMI &nbsp;|&nbsp; GSTIN: 37KATPS1500Q1ZR
              </div>
              <div style={{ fontSize: '0.67rem', color: '#000000', lineHeight: '1.25' }}>
                D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.
              </div>
            </div>
            <div style={{ width: '84px', textAlign: 'right', flexShrink: 0 }}>
              <img
                src={ramDarbarImg}
                alt="Ram Darbar"
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* 3. DETAILS BASED ON BILL TYPE */}
          {type === 'ice' && (
            <>
              {/* Voucher No & Date */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ padding: '6px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Voucher No.</span>
                  <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                    {resolvedVoucherNo}
                  </span>
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                  <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(data.date)}</span>
                </div>
              </div>

              {/* From & To */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ padding: '6px 10px', borderRight: '1.5px solid #0b5394' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Ice From (Supplier): </span>
                  <strong style={{ color: '#000000' }}>{data.iceFrom || data.supplierName || 'Sri Rama Ice Plant'}</strong>
                </div>
                <div style={{ padding: '6px 10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Ice To (Receiver): </span>
                  <strong style={{ color: '#000000' }}>{data.iceTo || 'Factory / Cold Storage'}</strong>
                </div>
              </div>

              {/* Payment Status (NO Vehicle / Transport row) */}
              <div
                style={{
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.82rem',
                  padding: '5px 10px',
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Payment Status: </span>
                <span style={{ fontWeight: 'bold', color: data.paymentStatus === 'Paid' ? '#16a34a' : '#d97706' }}>
                  {data.paymentStatus || 'Paid'}
                </span>
              </div>

              {/* Table: Description is ICE */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 4px', width: '45px' }}>S.No.</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 8px', textAlign: 'left' }}>Description of Supply</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '120px' }}>Quantity</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '110px' }}>Rate (₹)</th>
                    <th style={{ borderBottom: '1.5px solid #0b5394', padding: '6px', width: '130px', textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: '32px', borderBottom: '1px solid #c8d9e8' }}>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', padding: '6px 8px', fontWeight: 'bold' }}>
                      ICE
                    </td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>
                      {data.blocks} blocks
                    </td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '8px' }}>
                      ₹{Number(data.rate).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                      ₹{Number(data.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                  {[1, 2].map((i) => (
                    <tr key={i} style={{ height: '22px', borderBottom: '1px solid #c8d9e8' }}>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#e8f1f8', borderTop: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                    <td colSpan={4} style={{ textAlign: 'right', padding: '8px 12px', color: '#0b5394', fontSize: '0.9rem', fontWeight: 900 }}>
                      TOTAL AMOUNT:
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 10px', fontSize: '1.05rem', fontWeight: 900, color: '#000000' }}>
                      ₹{Number(data.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Amount in Words (NO Notes / Remarks row as requested) */}
              <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Amount in Words: </span>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>{numberToWords(data.totalAmount)}</span>
              </div>
            </>
          )}

          {type === 'worker' && (
            <>
              {/* Voucher No & Date */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ padding: '6px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Voucher No.</span>
                  <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                    {resolvedVoucherNo}
                  </span>
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                  <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(data.date)}</span>
                </div>
              </div>

              {/* Worker Name Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1.5px solid #0b5394',
                  padding: '6px 10px',
                  gap: '10px',
                  fontSize: '0.9rem',
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Worker Name:</span>
                <strong style={{ fontSize: '1.05rem', color: '#000000' }}>{data.staffName}</strong>
                {data.staffPhone && (
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                    Cell: <strong>{data.staffPhone}</strong>
                  </span>
                )}
              </div>

              {/* Work Category & Status */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Work Category & Shift: </span>
                  <span style={{ fontWeight: 'bold' }}>{data.workType || 'Processing'} ({data.shift || 'Full Day'})</span>
                </div>
                <div style={{ padding: '5px 10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Payment Status: </span>
                  <span style={{ fontWeight: 'bold', color: data.paymentStatus === 'Paid' ? '#16a34a' : '#d97706' }}>
                    {data.paymentStatus || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 4px', width: '45px' }}>S.No.</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px 8px', textAlign: 'left' }}>Work Description / Service</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '120px' }}>Weight (kg)</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '6px', width: '110px' }}>Rate (₹/kg)</th>
                    <th style={{ borderBottom: '1.5px solid #0b5394', padding: '6px', width: '130px', textAlign: 'right' }}>Total Wages (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: '32px', borderBottom: '1px solid #c8d9e8' }}>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                    <td style={{ borderRight: '1.5px solid #0b5394', padding: '6px 8px', fontWeight: 'bold' }}>
                      {data.workType || 'Seafood Labor Processing'} ({data.shift || 'Full Day'})
                    </td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', fontWeight: 'bold' }}>
                      {data.quantity} kg
                    </td>
                    <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '8px' }}>
                      ₹{Number(data.price).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                      ₹{Number(data.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                  {[1, 2].map((i) => (
                    <tr key={i} style={{ height: '22px', borderBottom: '1px solid #c8d9e8' }}>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#e8f1f8', borderTop: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                    <td colSpan={4} style={{ textAlign: 'right', padding: '8px 12px', color: '#0b5394', fontSize: '0.9rem', fontWeight: 900 }}>
                      TOTAL WAGE AMOUNT:
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 10px', fontSize: '1.05rem', fontWeight: 900, color: '#000000' }}>
                      ₹{Number(data.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Amount in Words */}
              <div style={{ borderTop: '1.5px solid #0b5394', padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff' }}>
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Amount in Words: </span>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>{numberToWords(data.totalAmount)}</span>
              </div>
            </>
          )}

          {type === 'statement' && (
            <>
              {/* Statement No & Date */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ padding: '6px 10px', borderRight: '1.5px solid #0b5394', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Statement No.</span>
                  <span style={{ fontWeight: 900, color: '#b12704', fontSize: '0.95rem' }}>
                    {resolvedVoucherNo}
                  </span>
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
                  <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatDate(new Date())}</span>
                </div>
              </div>

              {/* Worker Name Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1.5px solid #0b5394',
                  padding: '6px 10px',
                  gap: '10px',
                  fontSize: '0.9rem',
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Worker Name:</span>
                <strong style={{ fontSize: '1.05rem', color: '#000000' }}>{data.workerName}</strong>
                {data.summary?.staffPhone && (
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                    Cell: <strong>{data.summary.staffPhone}</strong>
                  </span>
                )}
              </div>

              {/* Days & Weight Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: '1.5px solid #0b5394',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ padding: '5px 10px', borderRight: '1.5px solid #0b5394' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Days Worked: </span>
                  <span style={{ fontWeight: 'bold' }}>{data.summary?.daysWorkedCount || data.entries?.length || 0} days</span>
                </div>
                <div style={{ padding: '5px 10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Total Weight Processed: </span>
                  <span style={{ fontWeight: 'bold' }}>{data.summary?.totalKg || 0} kg</span>
                </div>
              </div>

              {/* Statement Entries Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f0f5fa', color: '#0b5394', fontWeight: 'bold', textAlign: 'center' }}>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px', width: '35px' }}>#</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 8px', textAlign: 'left', width: '85px' }}>Date</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px 8px', textAlign: 'left' }}>Work Category & Shift</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px', width: '80px' }}>Weight (kg)</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px', width: '75px' }}>Rate</th>
                    <th style={{ borderRight: '1.5px solid #0b5394', borderBottom: '1.5px solid #0b5394', padding: '5px', width: '85px' }}>Status</th>
                    <th style={{ borderBottom: '1.5px solid #0b5394', padding: '5px 8px', width: '95px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.entries || []).slice(0, 15).map((row, idx) => (
                    <tr key={row._id || idx} style={{ height: '24px', borderBottom: '1px solid #c8d9e8' }}>
                      <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ borderRight: '1.5px solid #0b5394', padding: '3px 8px' }}>{formatDate(row.date)}</td>
                      <td style={{ borderRight: '1.5px solid #0b5394', padding: '3px 8px' }}>{row.workType} ({row.shift})</td>
                      <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center' }}>{row.quantity} kg</td>
                      <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'right', paddingRight: '6px' }}>₹{Number(row.price).toFixed(2)}</td>
                      <td style={{ borderRight: '1.5px solid #0b5394', textAlign: 'center', color: row.paymentStatus === 'Paid' ? '#16a34a' : '#d97706', fontWeight: 'bold' }}>
                        {row.paymentStatus}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>₹{Number(row.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#e8f1f8', borderTop: '1.5px solid #0b5394', fontWeight: 'bold' }}>
                    <td colSpan={6} style={{ textAlign: 'right', padding: '6px 12px', color: '#0b5394', fontSize: '0.85rem' }}>
                      TOTAL EARNED:
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.95rem', fontWeight: 900, color: '#000000' }}>
                      ₹{Number(data.summary?.totalEarned || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ background: '#ffffff', borderTop: '1px solid #c8d9e8' }}>
                    <td colSpan={6} style={{ textAlign: 'right', padding: '4px 12px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      TOTAL PAID:
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.95rem', fontWeight: 800, color: '#16a34a' }}>
                      ₹{Number(data.summary?.totalPaid || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ background: '#fef3c7', borderTop: '1.5px solid #0b5394' }}>
                    <td colSpan={6} style={{ textAlign: 'right', padding: '6px 12px', color: '#b45309', fontSize: '0.9rem', fontWeight: 900 }}>
                      PENDING BALANCE DUE:
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '1.05rem', fontWeight: 900, color: '#b45309' }}>
                      ₹{Number(data.summary?.pendingBalance || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {/* 4. FOOTER: BANK DETAILS & SIGNATURE */}
          {/* Note: Worker signature removed as requested. Only Company Authorised Signature */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              borderTop: '1.5px solid #0b5394',
              fontSize: '0.74rem',
              lineHeight: '1.4',
            }}
          >
            <div
              style={{
                borderRight: '1.5px solid #0b5394',
                padding: '8px 12px',
                background: '#fafafa',
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#0b5394', marginBottom: '2px', fontSize: '0.76rem' }}>
                Bank Account Details:
              </div>
              <div><strong>Bank:</strong> KARUR VYSYA BANK</div>
              <div><strong>A/C No:</strong> 4805135000002964</div>
              <div><strong>IFSC:</strong> KVBL0004815 &nbsp;|&nbsp; <strong>Branch:</strong> Narasapur</div>
            </div>

            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'center',
                background: '#ffffff',
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#0b5394', fontSize: '0.8rem' }}>
                For VIJAYA DURGA SEA FOODS
              </div>
              <div
                style={{
                  marginTop: '32px',
                  borderTop: '1px solid #000000',
                  paddingTop: '2px',
                  fontWeight: 'bold',
                  color: '#0b5394',
                  fontSize: '0.75rem',
                }}
              >
                Proprietor / Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

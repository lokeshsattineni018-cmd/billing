/**
 * Create reusable SMTP transporter (Gmail App Password or custom SMTP)
 */
function createTransporter(settings = {}) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    throw new Error('Nodemailer package is not installed. Run npm install nodemailer.');
  }

  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = settings.smtpPass || process.env.SMTP_PASS;
  const host = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured. Please enter your Sender Gmail and 16-character App Password in Settings -> Daily Email Backup.');
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    senderEmail: user,
  };
}

/** Format INR currency */
function fmtINR(num) {
  return Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Send daily summary email — Clean Professional Business Report
 */
async function sendDailySummaryEmail({ recipientEmail, date, bills, summary, settings = {} }) {
  const { transporter, senderEmail } = createTransporter(settings);

  const reportDate = new Date(date);
  const dateStr = reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const shortDate = reportDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  // CSV
  const csvHeaders = 'S.No,Invoice No,Date,Customer,Qty (KG),Rate,Amount,Status\n';
  const csvRows = bills.map((b, i) => {
    const qty = b.items && b.items.length > 0 ? b.items.reduce((s, it) => s + (it.quantity || 0), 0) : (b.quantity || 0);
    const rate = b.items && b.items.length > 0 ? (b.items[0].rate || 0) : (b.rate || 0);
    return `${i + 1},${b.billNo},"${new Date(b.date).toLocaleDateString('en-IN')}","${b.companyName}",${qty},${rate},${b.grandTotal || b.total},${b.paymentStatus || 'Pending'}`;
  }).join('\n');
  const csvContent = csvHeaders + csvRows;

  // Metrics
  const paidBills = bills.filter(b => b.paymentStatus === 'Paid');
  const pendingBills = bills.filter(b => b.paymentStatus !== 'Paid');
  const paidAmt = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const pendingAmt = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const totalKg = bills.reduce((s, b) => {
    if (b.items && b.items.length > 0) return s + b.items.reduce((ss, it) => ss + (it.quantity || 0), 0);
    return s + (b.quantity || 0);
  }, 0);

  // Invoice rows
  let invoiceRows = '';
  if (bills.length > 0) {
    invoiceRows = bills.map((b, i) => {
      const qty = b.items && b.items.length > 0 ? b.items.reduce((s, it) => s + (it.quantity || 0), 0) : (b.quantity || 0);
      const st = b.paymentStatus || 'Pending';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:center;color:#333;">${i + 1}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:center;font-weight:600;color:#0b5394;">${b.billNo}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#222;">${b.companyName}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right;color:#555;">${Number(qty).toLocaleString('en-IN')}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-weight:600;color:#222;">${fmtINR(b.grandTotal || b.total)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:11px;text-align:center;font-weight:700;color:${st === 'Paid' ? '#16a34a' : '#d97706'};">${st}</td>
      </tr>`;
    }).join('');
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,'Times New Roman',serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f5;">
<tr><td align="center" style="padding:20px 10px 36px;">
<table cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d4d4d4;">

  <!-- LETTERHEAD -->
  <tr><td style="padding:28px 32px 20px;border-bottom:3px solid #0b5394;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <div style="font-size:22px;font-weight:700;color:#0b5394;font-family:Georgia,serif;letter-spacing:0.5px;">VIJAYA DURGA AGENCIES</div>
          <div style="font-size:11px;color:#666;margin-top:3px;font-family:Arial,sans-serif;line-height:1.5;">
            D.No. 2-41A, Near Ramalayam, KOTHOTA - 534 281, West Godavari, A.P.<br>
            Ph: 9441429745 &nbsp;|&nbsp; GSTIN: 37KATPS1500Q1ZR
          </div>
        </td>
        <td align="right" valign="top">
          <div style="font-size:10px;color:#999;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">Report Date</div>
          <div style="font-size:16px;font-weight:700;color:#222;font-family:Georgia,serif;margin-top:2px;">${shortDate}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- TITLE -->
  <tr><td style="padding:20px 32px 12px;">
    <div style="font-size:14px;font-weight:700;color:#222;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #ddd;padding-bottom:8px;">
      Daily Sales &amp; Collection Report
    </div>
    <div style="font-size:12px;color:#888;font-family:Arial,sans-serif;margin-top:6px;">${dateStr}</div>
  </td></tr>

  <!-- SUMMARY TABLE -->
  <tr><td style="padding:8px 32px 20px;">
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #ddd;border-collapse:collapse;">
      <tr style="background:#f8f8f8;">
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:11px;font-family:Arial,sans-serif;color:#666;font-weight:700;text-transform:uppercase;width:50%;">Description</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:11px;font-family:Arial,sans-serif;color:#666;font-weight:700;text-transform:uppercase;text-align:right;">Amount (&#8377;)</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:11px;font-family:Arial,sans-serif;color:#666;font-weight:700;text-transform:uppercase;text-align:center;">Count</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#222;">Total Revenue (Gross Sales)</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:14px;font-family:Georgia,serif;font-weight:700;color:#0b5394;text-align:right;">&#8377;${fmtINR(summary.totalRevenue)}</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#222;text-align:center;">${summary.totalBills} invoice${summary.totalBills !== 1 ? 's' : ''}</td>
      </tr>
      <tr style="background:#f0fdf4;">
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#15803d;">Collected (Paid)</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:14px;font-family:Georgia,serif;font-weight:700;color:#16a34a;text-align:right;">&#8377;${fmtINR(paidAmt)}</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#15803d;text-align:center;">${paidBills.length}</td>
      </tr>
      <tr style="background:#fffbeb;">
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#92400e;">Outstanding (Pending / Credit)</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:14px;font-family:Georgia,serif;font-weight:700;color:#d97706;text-align:right;">&#8377;${fmtINR(pendingAmt)}</td>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#92400e;text-align:center;">${pendingBills.length}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;font-family:Arial,sans-serif;color:#222;">Total Quantity Dispatched</td>
        <td colspan="2" style="padding:10px 14px;border:1px solid #ddd;font-size:14px;font-family:Georgia,serif;font-weight:700;color:#222;text-align:right;">${Number(totalKg).toLocaleString('en-IN')} KG</td>
      </tr>
    </table>
  </td></tr>

  ${bills.length > 0 ? `
  <!-- INVOICE DETAILS -->
  <tr><td style="padding:4px 32px 8px;">
    <div style="font-size:12px;font-weight:700;color:#222;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #ddd;padding-bottom:6px;">
      Invoice-wise Breakup
    </div>
  </td></tr>

  <tr><td style="padding:4px 32px 20px;">
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #ddd;border-collapse:collapse;">
      <tr style="background:#0b5394;">
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:center;border:1px solid #094175;">S.No</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:center;border:1px solid #094175;">Inv #</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:left;border:1px solid #094175;">Customer Name</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:right;border:1px solid #094175;">Qty (KG)</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:right;border:1px solid #094175;">Amount (&#8377;)</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#fff;font-family:Arial,sans-serif;text-align:center;border:1px solid #094175;">Status</th>
      </tr>
      ${invoiceRows}
      <tr style="background:#f8f8f8;">
        <td colspan="3" style="padding:9px 10px;border:1px solid #ddd;font-size:12px;font-weight:700;font-family:Arial,sans-serif;color:#222;text-align:right;">TOTAL</td>
        <td style="padding:9px 10px;border:1px solid #ddd;font-size:12px;font-weight:700;font-family:Arial,sans-serif;color:#222;text-align:right;">${Number(totalKg).toLocaleString('en-IN')}</td>
        <td style="padding:9px 10px;border:1px solid #ddd;font-size:13px;font-weight:700;font-family:Georgia,serif;color:#0b5394;text-align:right;">&#8377;${fmtINR(summary.totalRevenue)}</td>
        <td style="padding:9px 10px;border:1px solid #ddd;font-size:11px;font-family:Arial,sans-serif;color:#666;text-align:center;">${summary.totalBills} bills</td>
      </tr>
    </table>
  </td></tr>
  ` : `
  <tr><td style="padding:20px 32px;text-align:center;">
    <div style="padding:20px;border:1px dashed #ccc;color:#999;font-size:13px;font-family:Arial,sans-serif;">
      No invoices were recorded on this date.
    </div>
  </td></tr>
  `}

  <!-- FOOTER -->
  <tr><td style="padding:16px 32px;border-top:3px solid #0b5394;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="font-size:10px;color:#999;font-family:Arial,sans-serif;line-height:1.6;">
          Report generated: ${generatedAt}<br>
          ${bills.length > 0 ? 'CSV spreadsheet attached for accounting records.' : ''}
        </td>
        <td align="right" style="font-size:10px;color:#bbb;font-family:Arial,sans-serif;">
          Vijaya Durga Agencies<br>Billing System
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const mailOptions = {
    from: `"VIJAYA DURGA AGENCIES" <${senderEmail}>`,
    to: recipientEmail,
    subject: `Sales Report \u2014 ${shortDate} | ${summary.totalBills} Bills, \u20b9${fmtINR(summary.totalRevenue)} Revenue`,
    html,
    attachments: bills.length > 0 ? [{
      filename: `VDA_Sales_Report_${shortDate.replace(/\s/g, '_')}.csv`,
      content: csvContent,
      contentType: 'text/csv',
    }] : [],
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendDailySummaryEmail };

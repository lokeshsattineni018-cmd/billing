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
function formatINR(num) {
  return Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Send daily summary email — Premium Executive Business Report
 */
async function sendDailySummaryEmail({ recipientEmail, date, bills, summary, settings = {} }) {
  const { transporter, senderEmail } = createTransporter(settings);

  const reportDate = new Date(date);
  const dateStr = reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const shortDate = reportDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  // CSV attachment
  const csvHeaders = 'S.No,Invoice No,Date,Customer Name,Quantity (KG),Rate,Amount,Payment Status\n';
  const csvRows = bills.map((b, i) => {
    const qty = b.items && b.items.length > 0
      ? b.items.reduce((s, item) => s + (item.quantity || 0), 0)
      : (b.quantity || 0);
    const rate = b.items && b.items.length > 0 ? (b.items[0].rate || 0) : (b.rate || 0);
    return `${i + 1},${b.billNo},"${new Date(b.date).toLocaleDateString('en-IN')}","${b.companyName}",${qty},${rate},${b.grandTotal || b.total},${b.paymentStatus || 'Pending'}`;
  }).join('\n');
  const csvContent = csvHeaders + csvRows;

  // Compute metrics
  const paidBills = bills.filter(b => b.paymentStatus === 'Paid');
  const pendingBills = bills.filter(b => b.paymentStatus !== 'Paid');
  const paidAmount = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const pendingAmount = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const totalKg = bills.reduce((s, b) => {
    if (b.items && b.items.length > 0) return s + b.items.reduce((ss, item) => ss + (item.quantity || 0), 0);
    return s + (b.quantity || 0);
  }, 0);
  const avgInvoice = bills.length > 0 ? (summary.totalRevenue / bills.length) : 0;
  const collectionRate = summary.totalRevenue > 0 ? ((paidAmount / summary.totalRevenue) * 100).toFixed(1) : '0.0';

  // Top customers by revenue
  const customerMap = {};
  bills.forEach(b => {
    const name = b.companyName || 'Walk-in';
    customerMap[name] = (customerMap[name] || 0) + (b.grandTotal || b.total || 0);
  });
  const topCustomers = Object.entries(customerMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Collection rate color
  const crColor = Number(collectionRate) >= 80 ? '#16a34a' : Number(collectionRate) >= 50 ? '#d97706' : '#dc2626';

  // Build invoice rows
  let invoiceRowsHtml = '';
  if (bills.length > 0) {
    invoiceRowsHtml = bills.map((b, idx) => {
      const qty = b.items && b.items.length > 0
        ? b.items.reduce((s, item) => s + (item.quantity || 0), 0)
        : (b.quantity || 0);
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusBg = b.paymentStatus === 'Paid' ? '#dcfce7' : b.paymentStatus === 'Partial' ? '#dbeafe' : '#fef3c7';
      const statusColor = b.paymentStatus === 'Paid' ? '#15803d' : b.paymentStatus === 'Partial' ? '#1d4ed8' : '#b45309';
      return `<tr style="background:${bgColor};">
        <td style="padding:9px 12px;text-align:center;font-size:12px;font-weight:800;color:#0b5394;border-bottom:1px solid #f1f5f9;">${b.billNo}</td>
        <td style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${b.companyName}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">${Number(qty).toLocaleString('en-IN')}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:800;color:#0f172a;border-bottom:1px solid #f1f5f9;">&#8377;${formatINR(b.grandTotal || b.total)}</td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #f1f5f9;">
          <span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:0.5px;background:${statusBg};color:${statusColor};">${b.paymentStatus || 'Pending'}</span>
        </td>
      </tr>`;
    }).join('');
  }

  // Build top customers HTML
  let topCustomersHtml = '';
  if (topCustomers.length > 1) {
    const custRows = topCustomers.map((c, i) => {
      const pct = summary.totalRevenue > 0 ? ((c[1] / summary.totalRevenue) * 100).toFixed(1) : '0';
      const rankBg = i === 0 ? '#0b5394' : i === 1 ? '#1e40af' : '#64748b';
      const borderBottom = i < topCustomers.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : '';
      return `<tr>
        <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#0f172a;${borderBottom}">
          <span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:${rankBg};color:#fff;text-align:center;line-height:20px;font-size:10px;font-weight:900;margin-right:8px;">${i + 1}</span>
          ${c[0]}
        </td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;font-weight:800;color:#0b5394;${borderBottom}">&#8377;${formatINR(c[1])}</td>
        <td style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;width:60px;${borderBottom}">${pct}%</td>
      </tr>`;
    }).join('');

    topCustomersHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:0 28px 24px 28px;">
      <tr><td>
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:12px;">&#128101; Top Customers by Revenue</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          ${custRows}
        </table>
      </td></tr>
    </table>`;
  }

  // ── Build the full HTML ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0f2f5;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="680" style="max-width:680px;width:100%;">

  <!-- HEADER BANNER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#0b5394 50%,#1e40af 100%);padding:0;border-radius:16px 16px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:28px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:6px;">Daily Business Intelligence Report</div>
              <div style="font-size:26px;font-weight:900;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">VIJAYA DURGA AGENCIES</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:4px;font-weight:500;">Fresh Seafood &amp; Prawns Supply &middot; GSTIN: 37KATPS1500Q1ZR</div>
            </td>
            <td align="right" valign="top" style="padding-top:4px;">
              <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 16px;display:inline-block;">
                <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Report Date</div>
                <div style="font-size:15px;font-weight:800;color:#ffffff;margin-top:2px;">${shortDate}</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:12px 32px 24px 32px;">
        <div style="height:1px;background:rgba(255,255,255,0.12);margin-bottom:12px;"></div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);font-weight:600;">${dateStr}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- WHITE BODY -->
  <tr><td style="background:#ffffff;padding:0;">

    <!-- KPI SECTION HEADER -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 28px 8px 28px;">
      <tr><td>
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:16px;">&#128202; Executive Summary &mdash; Key Performance Indicators</div>
      </td></tr>
    </table>

    <!-- 3 KPI CARDS -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:0 24px 24px 24px;">
      <tr>
        <td width="33%" style="padding:4px;">
          <div style="background:linear-gradient(135deg,#0b5394,#1e40af);border-radius:12px;padding:18px 16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Total Revenue</div>
            <div style="font-size:22px;font-weight:900;color:#ffffff;margin-top:6px;letter-spacing:-0.5px;">&#8377;${formatINR(summary.totalRevenue)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:4px;font-weight:600;">${summary.totalBills} invoice${summary.totalBills !== 1 ? 's' : ''} raised</div>
          </div>
        </td>
        <td width="33%" style="padding:4px;">
          <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:18px 16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#15803d;text-transform:uppercase;">Cash Collected</div>
            <div style="font-size:22px;font-weight:900;color:#16a34a;margin-top:6px;letter-spacing:-0.5px;">&#8377;${formatINR(paidAmount)}</div>
            <div style="font-size:11px;color:#4ade80;margin-top:4px;font-weight:700;">${paidBills.length} paid</div>
          </div>
        </td>
        <td width="33%" style="padding:4px;">
          <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:18px 16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#b45309;text-transform:uppercase;">Outstanding</div>
            <div style="font-size:22px;font-weight:900;color:#d97706;margin-top:6px;letter-spacing:-0.5px;">&#8377;${formatINR(pendingAmount)}</div>
            <div style="font-size:11px;color:#f59e0b;margin-top:4px;font-weight:700;">${pendingBills.length} pending</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- SECONDARY METRICS BAR -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:0 28px 24px 28px;">
      <tr><td style="padding:0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td width="25%" style="padding:14px 12px;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Total Qty</div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:4px;">${Number(totalKg).toLocaleString('en-IN')} KG</div>
            </td>
            <td width="25%" style="padding:14px 12px;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Avg Invoice</div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:4px;">&#8377;${formatINR(avgInvoice)}</div>
            </td>
            <td width="25%" style="padding:14px 12px;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Collection Rate</div>
              <div style="font-size:17px;font-weight:900;color:${crColor};margin-top:4px;">${collectionRate}%</div>
            </td>
            <td width="25%" style="padding:14px 12px;text-align:center;">
              <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Unique Buyers</div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:4px;">${Object.keys(customerMap).length}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- DIVIDER -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:0 28px;">
      <tr><td style="border-top:2px solid #f1f5f9;"></td></tr>
    </table>

    ${bills.length > 0 ? `
    <!-- INVOICE LEDGER -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 28px 8px 28px;">
      <tr><td>
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">&#128203; Invoice Ledger &mdash; Transaction Details</div>
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:0 28px 24px 28px;">
      <tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#0b5394;">
              <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:800;color:#ffffff;letter-spacing:0.5px;border-bottom:2px solid #094175;">INV #</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:800;color:#ffffff;letter-spacing:0.5px;border-bottom:2px solid #094175;">CUSTOMER NAME</th>
              <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:800;color:#ffffff;letter-spacing:0.5px;border-bottom:2px solid #094175;">QTY (KG)</th>
              <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:800;color:#ffffff;letter-spacing:0.5px;border-bottom:2px solid #094175;">AMOUNT</th>
              <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:800;color:#ffffff;letter-spacing:0.5px;border-bottom:2px solid #094175;">STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceRowsHtml}
            <tr style="background:#0f172a;">
              <td colspan="2" style="padding:11px 12px;font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">GRAND TOTAL</td>
              <td style="padding:11px 12px;text-align:right;font-size:12px;font-weight:800;color:#ffffff;">${Number(totalKg).toLocaleString('en-IN')} KG</td>
              <td style="padding:11px 12px;text-align:right;font-size:13px;font-weight:900;color:#4ade80;">&#8377;${formatINR(summary.totalRevenue)}</td>
              <td style="padding:11px 12px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);">${summary.totalBills} inv</td>
            </tr>
          </tbody>
        </table>
      </td></tr>
    </table>

    ${topCustomersHtml}
    ` : `
    <!-- NO DATA -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px;">
      <tr><td style="text-align:center;padding:32px 20px;background:#f8fafc;border-radius:12px;border:1.5px dashed #cbd5e1;">
        <div style="font-size:36px;margin-bottom:12px;">&#128237;</div>
        <div style="font-size:15px;font-weight:800;color:#334155;margin-bottom:4px;">No Invoices Recorded</div>
        <div style="font-size:12px;color:#94a3b8;font-weight:500;">No transactions were created on ${dateStr}.</div>
      </td></tr>
    </table>
    `}

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0a1628;padding:24px 32px;border-radius:0 0 16px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <div style="font-size:13px;font-weight:800;color:#ffffff;">VIJAYA DURGA AGENCIES</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:4px;line-height:1.6;">
            D.No. 2-41A, Near Ramalayam, KOTHOTA - 534 281<br>
            Mutyalapalli, West Godavari Dist., A.P.<br>
            Cell: 9441429745 &middot; GSTIN: 37KATPS1500Q1ZR
          </div>
        </td>
        <td align="right" valign="top">
          <div style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:500;text-align:right;">
            Report generated on<br>
            <span style="font-weight:700;color:rgba(255,255,255,0.55);">${generatedAt}</span>
          </div>
          <div style="margin-top:8px;font-size:9px;color:rgba(255,255,255,0.25);font-weight:500;">
            ${bills.length > 0 ? '&#128206; CSV spreadsheet attached' : 'No attachment'}
          </div>
        </td>
      </tr>
    </table>
    <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:12px;text-align:center;">
      <div style="font-size:9px;color:rgba(255,255,255,0.25);font-weight:500;letter-spacing:0.5px;">
        This is an auto-generated confidential business report. Do not forward to unauthorized personnel.<br>
        &copy; ${new Date().getFullYear()} Vijaya Durga Agencies &middot; Powered by VDA Billing System
      </div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const mailOptions = {
    from: `"VIJAYA DURGA AGENCIES" <${senderEmail}>`,
    to: recipientEmail,
    subject: `\ud83d\udcca Business Report \u2014 ${shortDate} | ${summary.totalBills} Invoices \u00b7 \u20b9${formatINR(summary.totalRevenue)} Revenue \u00b7 \u20b9${formatINR(pendingAmount)} Outstanding`,
    html,
    attachments: bills.length > 0 ? [{
      filename: `VDA_Business_Report_${shortDate.replace(/\s/g, '_')}.csv`,
      content: csvContent,
      contentType: 'text/csv',
    }] : [],
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendDailySummaryEmail };

const { generateDailyReportPDF } = require('./dailyReportPdf');

/**
 * Create reusable SMTP transporter
 */
function createTransporter(settings = {}) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    throw new Error('Nodemailer package is not installed.');
  }

  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = settings.smtpPass || process.env.SMTP_PASS;
  const host = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured. Please enter your Sender Gmail and App Password in Settings → Daily Email Backup.');
  }

  return {
    transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    senderEmail: user,
  };
}

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Send daily summary email with PDF report attached
 */
async function sendDailySummaryEmail({ recipientEmail, date, bills, summary, settings = {} }) {
  const { transporter, senderEmail } = createTransporter(settings);

  const reportDate = new Date(date);
  const shortDate = reportDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const longDate = reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Metrics
  const paidBills = bills.filter(b => b.paymentStatus === 'Paid');
  const pendingBills = bills.filter(b => b.paymentStatus !== 'Paid');
  const paidAmt = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const pendingAmt = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const totalKg = bills.reduce((s, b) => {
    if (b.items && b.items.length > 0) return s + b.items.reduce((ss, it) => ss + (it.quantity || 0), 0);
    return s + (b.quantity || 0);
  }, 0);

  // Generate PDF
  const pdfBuffer = await generateDailyReportPDF({ date, bills, summary });

  // Clean, minimal email body — the PDF has all details
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;">
<tr><td align="center" style="padding:24px 10px 32px;">
<table cellpadding="0" cellspacing="0" width="580" style="max-width:580px;width:100%;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

  <!-- Blue strip -->
  <tr><td style="background:#0b5394;height:5px;font-size:0;">&nbsp;</td></tr>

  <!-- Content -->
  <tr><td style="padding:28px 32px;">
    <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">Daily Sales Report</div>
    <div style="font-size:13px;color:#888;margin-bottom:20px;">${longDate}</div>

    <!-- Quick numbers -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr>
        <td width="33%" style="padding:0 4px 0 0;">
          <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:14px 12px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Revenue</div>
            <div style="font-size:18px;font-weight:700;color:#0b5394;margin-top:4px;">${fmtINR(summary.totalRevenue)}</div>
          </div>
        </td>
        <td width="33%" style="padding:0 2px;">
          <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:6px;padding:14px 12px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Collected</div>
            <div style="font-size:18px;font-weight:700;color:#16a34a;margin-top:4px;">${fmtINR(paidAmt)}</div>
          </div>
        </td>
        <td width="33%" style="padding:0 0 0 4px;">
          <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:6px;padding:14px 12px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;">Pending</div>
            <div style="font-size:18px;font-weight:700;color:#d97706;margin-top:4px;">${fmtINR(pendingAmt)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Stats row -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="font-size:12px;color:#555;">
          <strong>${summary.totalBills}</strong> invoice${summary.totalBills !== 1 ? 's' : ''} &nbsp;&middot;&nbsp;
          <strong>${Number(totalKg).toLocaleString('en-IN')}</strong> KG dispatched &nbsp;&middot;&nbsp;
          <strong>${paidBills.length}</strong> paid, <strong>${pendingBills.length}</strong> pending
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <div style="border-top:1px solid #eee;margin-bottom:18px;"></div>

    <!-- PDF callout -->
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding:14px 16px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;">
          <div style="font-size:13px;color:#333;line-height:1.6;">
            <strong style="color:#0b5394;">&#128206; PDF Report Attached</strong><br>
            <span style="font-size:12px;color:#666;">Open the attached PDF for the complete invoice-wise breakup with totals. You can save, print, or forward it to your CA.</span>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="font-size:10px;color:#aaa;">VIJAYA DURGA AGENCIES</td>
        <td align="right" style="font-size:10px;color:#ccc;">Billing System</td>
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
    subject: `Sales Report \u2014 ${shortDate} | ${summary.totalBills} Bills, \u20b9${fmtINR(summary.totalRevenue)}`,
    html,
    attachments: [
      {
        filename: `VDA_Sales_Report_${shortDate.replace(/\s/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendDailySummaryEmail };

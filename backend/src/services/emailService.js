const { generateDailyReportPDF } = require('./dailyReportPdf');

function createTransporter(settings = {}) {
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) { throw new Error('Nodemailer not installed.'); }

  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = settings.smtpPass || process.env.SMTP_PASS;
  const host = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);

  if (!user || !pass) throw new Error('SMTP credentials not configured. Enter Gmail & App Password in Settings.');

  return {
    transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    senderEmail: user,
  };
}

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendDailySummaryEmail({ recipientEmail, date, bills, summary, settings = {} }) {
  const { transporter, senderEmail } = createTransporter(settings);

  const reportDate = new Date(date);
  const shortDate = reportDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const longDate = reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const paidBills = bills.filter(b => b.paymentStatus === 'Paid');
  const pendingBills = bills.filter(b => b.paymentStatus !== 'Paid');
  const paidAmt = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const pendingAmt = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const totalKg = bills.reduce((s, b) => {
    if (b.items && b.items.length > 0) return s + b.items.reduce((ss, it) => ss + (it.quantity || 0), 0);
    return s + (b.quantity || 0);
  }, 0);

  const pdfBuffer = await generateDailyReportPDF({ date, bills, summary });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;">
<tr><td align="center" style="padding:20px 10px 30px;">
<table cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #ddd;">

  <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #ddd;">
    <div style="font-size:15px;font-weight:700;color:#111;">Daily Sales Report</div>
    <div style="font-size:12px;color:#888;margin-top:3px;">${longDate}</div>
  </td></tr>

  <tr><td style="padding:18px 28px;">
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #ddd;border-collapse:collapse;">
      <tr style="background:#f5f5f5;">
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:10px;font-weight:700;color:#666;">Particulars</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:10px;font-weight:700;color:#666;text-align:right;">Amount</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:10px;font-weight:700;color:#666;text-align:center;">Count</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#333;">Gross Sales</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;font-weight:700;color:#111;text-align:right;">Rs. ${fmtINR(summary.totalRevenue)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#666;text-align:center;">${summary.totalBills}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#333;">Collected</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;font-weight:700;color:#111;text-align:right;">Rs. ${fmtINR(paidAmt)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#666;text-align:center;">${paidBills.length}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#333;">Outstanding</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;font-weight:700;color:#111;text-align:right;">Rs. ${fmtINR(pendingAmt)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#666;text-align:center;">${pendingBills.length}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:12px;color:#333;">Qty Dispatched</td>
        <td colspan="2" style="padding:8px 12px;border:1px solid #ddd;font-size:12px;font-weight:700;color:#111;text-align:right;">${Number(totalKg).toLocaleString('en-IN')} KG</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:4px 28px 20px;">
    <div style="font-size:12px;color:#555;line-height:1.6;">
      Detailed invoice-wise report is attached as PDF.
    </div>
  </td></tr>

  <tr><td style="padding:12px 28px;border-top:1px solid #ddd;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="font-size:10px;color:#aaa;">Vijaya Durga Agencies</td>
        <td align="right" style="font-size:10px;color:#ccc;">${shortDate}</td>
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
    subject: `Sales Report - ${shortDate} | ${summary.totalBills} Bills, Rs.${fmtINR(summary.totalRevenue)}`,
    html,
    attachments: [{
      filename: `VDA_Sales_Report_${shortDate.replace(/\s/g, '_')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  };

  return await transporter.sendMail(mailOptions);
}

module.exports = { sendDailySummaryEmail };

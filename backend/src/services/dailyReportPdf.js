const PDFDocument = require('pdfkit');

/** Format INR */
function fmtINR(num) {
  return Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate a professional daily sales report PDF buffer
 */
async function generateDailyReportPDF({ date, bills, summary }) {
  return new Promise((resolve, reject) => {
    try {
      const reportDate = new Date(date);
      const shortDate = reportDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const longDate = reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

      const paidBills = bills.filter(b => b.paymentStatus === 'Paid');
      const pendingBills = bills.filter(b => b.paymentStatus !== 'Paid');
      const paidAmt = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
      const pendingAmt = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
      const totalKg = bills.reduce((s, b) => {
        if (b.items && b.items.length > 0) return s + b.items.reduce((ss, it) => ss + (it.quantity || 0), 0);
        return s + (b.quantity || 0);
      }, 0);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Daily Sales Report - ${shortDate}`,
          Author: 'VIJAYA DURGA AGENCIES',
          Subject: `Business Report for ${shortDate}`,
        },
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const L = 40;
      const R = doc.page.width - 40;
      const W = R - L;
      const blue = '#0b5394';
      const dark = '#1a1a1a';
      const gray = '#666666';
      const lightGray = '#999999';

      let y = 40;

      // ═══ TOP BLUE BAR ═══
      doc.rect(L, y, W, 4).fill(blue);
      y += 12;

      // ═══ COMPANY HEADER ═══
      doc.font('Helvetica-Bold').fontSize(20).fillColor(blue);
      doc.text('VIJAYA DURGA AGENCIES', L, y);
      y += 24;

      doc.font('Helvetica').fontSize(9).fillColor(gray);
      doc.text('D.No. 2-41A, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.', L, y);
      y += 13;
      doc.text('Cell: 9441429745  |  GSTIN: 37KATPS1500Q1ZR  |  Fresh Seafood & Prawns Supply', L, y);
      y += 20;

      // Thin line
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
      y += 16;

      // ═══ REPORT TITLE ═══
      doc.font('Helvetica-Bold').fontSize(13).fillColor(dark);
      doc.text('DAILY SALES & COLLECTION REPORT', L, y);
      y += 18;

      doc.font('Helvetica').fontSize(10).fillColor(gray);
      doc.text(longDate, L, y);

      // Report Date right-aligned
      doc.font('Helvetica-Bold').fontSize(10).fillColor(dark);
      doc.text(shortDate, L, y, { width: W, align: 'right' });
      y += 24;

      // Thick blue line
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(blue).stroke();
      y += 20;

      // ═══ SUMMARY TABLE ═══
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(dark);
      doc.text('FINANCIAL SUMMARY', L, y);
      y += 16;

      const summaryData = [
        ['Total Revenue (Gross Sales)', `₹${fmtINR(summary.totalRevenue)}`, `${summary.totalBills} invoice${summary.totalBills !== 1 ? 's' : ''}`],
        ['Amount Collected (Paid)', `₹${fmtINR(paidAmt)}`, `${paidBills.length} paid`],
        ['Outstanding Balance (Pending)', `₹${fmtINR(pendingAmt)}`, `${pendingBills.length} pending`],
        ['Total Quantity Dispatched', `${Number(totalKg).toLocaleString('en-IN')} KG`, ''],
      ];

      const colWidths = [W * 0.50, W * 0.30, W * 0.20];

      // Header row
      doc.rect(L, y, W, 22).fill('#f5f5f5');
      doc.rect(L, y, W, 22).lineWidth(0.5).strokeColor('#dddddd').stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor(gray);
      doc.text('DESCRIPTION', L + 10, y + 7);
      doc.text('AMOUNT', L + colWidths[0] + 10, y + 7, { width: colWidths[1] - 20, align: 'right' });
      doc.text('COUNT', L + colWidths[0] + colWidths[1] + 10, y + 7, { width: colWidths[2] - 20, align: 'center' });
      y += 22;

      summaryData.forEach((row, idx) => {
        const rowH = 24;
        const bgColor = idx === 1 ? '#f0fdf4' : idx === 2 ? '#fffbeb' : '#ffffff';
        doc.rect(L, y, W, rowH).fill(bgColor);
        doc.rect(L, y, W, rowH).lineWidth(0.5).strokeColor('#e0e0e0').stroke();

        doc.font('Helvetica').fontSize(9.5).fillColor(dark);
        doc.text(row[0], L + 10, y + 7);

        const amtColor = idx === 0 ? blue : idx === 1 ? '#16a34a' : idx === 2 ? '#d97706' : dark;
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(amtColor);
        doc.text(row[1], L + colWidths[0] + 10, y + 6, { width: colWidths[1] - 20, align: 'right' });

        if (row[2]) {
          const cntColor = idx === 1 ? '#16a34a' : idx === 2 ? '#d97706' : gray;
          doc.font('Helvetica').fontSize(9).fillColor(cntColor);
          doc.text(row[2], L + colWidths[0] + colWidths[1] + 10, y + 7, { width: colWidths[2] - 20, align: 'center' });
        }

        y += rowH;
      });

      y += 24;

      // ═══ INVOICE TABLE ═══
      if (bills.length > 0) {
        // Check if we need a new page
        if (y > doc.page.height - 200) {
          doc.addPage();
          y = 40;
        }

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(dark);
        doc.text('INVOICE-WISE BREAKUP', L, y);
        y += 16;

        // Table columns: S.No, Inv#, Customer, Qty(KG), Amount, Status
        const tCols = [35, 50, W - 35 - 50 - 70 - 110 - 65, 70, 110, 65];
        const tHeaders = ['S.No', 'Inv #', 'Customer Name', 'Qty (KG)', 'Amount (₹)', 'Status'];
        const headerH = 22;

        // Header
        doc.rect(L, y, W, headerH).fill(blue);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
        let hx = L;
        tHeaders.forEach((h, i) => {
          const align = i >= 3 ? (i === 5 ? 'center' : 'right') : 'left';
          doc.text(h, hx + 6, y + 7, { width: tCols[i] - 12, align });
          hx += tCols[i];
        });
        y += headerH;

        // Data rows
        bills.forEach((b, idx) => {
          const qty = b.items && b.items.length > 0
            ? b.items.reduce((s, it) => s + (it.quantity || 0), 0)
            : (b.quantity || 0);
          const status = b.paymentStatus || 'Pending';
          const rowH = 20;

          // New page check
          if (y + rowH > doc.page.height - 80) {
            doc.addPage();
            y = 40;
            // Re-draw header on new page
            doc.rect(L, y, W, headerH).fill(blue);
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
            let nhx = L;
            tHeaders.forEach((h, i) => {
              const align = i >= 3 ? (i === 5 ? 'center' : 'right') : 'left';
              doc.text(h, nhx + 6, y + 7, { width: tCols[i] - 12, align });
              nhx += tCols[i];
            });
            y += headerH;
          }

          const bg = idx % 2 === 0 ? '#ffffff' : '#fafafa';
          doc.rect(L, y, W, rowH).fill(bg);
          doc.rect(L, y, W, rowH).lineWidth(0.3).strokeColor('#e8e8e8').stroke();

          let rx = L;
          // S.No
          doc.font('Helvetica').fontSize(9).fillColor(gray);
          doc.text(`${idx + 1}`, rx + 6, y + 6, { width: tCols[0] - 12, align: 'left' });
          rx += tCols[0];

          // Inv #
          doc.font('Helvetica-Bold').fontSize(9).fillColor(blue);
          doc.text(`${b.billNo}`, rx + 6, y + 6, { width: tCols[1] - 12, align: 'left' });
          rx += tCols[1];

          // Customer
          doc.font('Helvetica').fontSize(9).fillColor(dark);
          doc.text(b.companyName || '-', rx + 6, y + 6, { width: tCols[2] - 12, align: 'left' });
          rx += tCols[2];

          // Qty
          doc.font('Helvetica').fontSize(9).fillColor(dark);
          doc.text(Number(qty).toLocaleString('en-IN'), rx + 6, y + 6, { width: tCols[3] - 12, align: 'right' });
          rx += tCols[3];

          // Amount
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(dark);
          doc.text(`₹${fmtINR(b.grandTotal || b.total)}`, rx + 6, y + 5.5, { width: tCols[4] - 12, align: 'right' });
          rx += tCols[4];

          // Status
          const stColor = status === 'Paid' ? '#16a34a' : '#d97706';
          doc.font('Helvetica-Bold').fontSize(8).fillColor(stColor);
          doc.text(status, rx + 6, y + 6.5, { width: tCols[5] - 12, align: 'center' });

          y += rowH;
        });

        // Totals row
        const totH = 22;
        doc.rect(L, y, W, totH).fill('#f0f0f0');
        doc.rect(L, y, W, totH).lineWidth(0.5).strokeColor('#cccccc').stroke();
        let tx = L;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(dark);
        doc.text('TOTAL', tx + 6, y + 7, { width: tCols[0] + tCols[1] + tCols[2] - 12, align: 'right' });
        tx += tCols[0] + tCols[1] + tCols[2];

        doc.font('Helvetica-Bold').fontSize(9).fillColor(dark);
        doc.text(`${Number(totalKg).toLocaleString('en-IN')} KG`, tx + 6, y + 7, { width: tCols[3] - 12, align: 'right' });
        tx += tCols[3];

        doc.font('Helvetica-Bold').fontSize(10).fillColor(blue);
        doc.text(`₹${fmtINR(summary.totalRevenue)}`, tx + 6, y + 6, { width: tCols[4] - 12, align: 'right' });
        tx += tCols[4];

        doc.font('Helvetica').fontSize(8).fillColor(gray);
        doc.text(`${summary.totalBills} bills`, tx + 6, y + 7, { width: tCols[5] - 12, align: 'center' });
        y += totH;
      }

      // ═══ FOOTER ═══
      y = doc.page.height - 60;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(blue).stroke();
      y += 10;

      doc.font('Helvetica').fontSize(7.5).fillColor(lightGray);
      doc.text(`Report generated: ${generatedAt}`, L, y);
      doc.text('Vijaya Durga Agencies Billing System', L, y, { width: W, align: 'right' });
      y += 12;
      doc.font('Helvetica').fontSize(6.5).fillColor('#bbbbbb');
      doc.text('This is a system-generated report. For queries contact 9441429745.', L, y, { width: W, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateDailyReportPDF };

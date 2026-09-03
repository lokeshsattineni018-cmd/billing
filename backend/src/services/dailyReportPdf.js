const PDFDocument = require('pdfkit');

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate a formal black & white daily sales report PDF
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
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Daily Sales Report - ${shortDate}`,
          Author: 'VIJAYA DURGA AGENCIES',
        },
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const L = 50;
      const R = doc.page.width - 50;
      const W = R - L;
      const black = '#000000';
      const darkGray = '#333333';
      const midGray = '#666666';

      let y = 50;

      // ═══ COMPANY NAME ═══
      doc.font('Helvetica-Bold').fontSize(16).fillColor(black);
      doc.text('VIJAYA DURGA AGENCIES', L, y);
      y += 20;

      doc.font('Helvetica').fontSize(8.5).fillColor(midGray);
      doc.text('D.No. 2-41A, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.', L, y);
      y += 11;
      doc.text('Cell: 9441429745   |   GSTIN: 37KATPS1500Q1ZR', L, y);
      y += 16;

      // Double line
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(black).stroke();
      doc.moveTo(L, y + 3).lineTo(R, y + 3).lineWidth(0.5).strokeColor(black).stroke();
      y += 14;

      // ═══ TITLE ═══
      doc.font('Helvetica-Bold').fontSize(12).fillColor(black);
      doc.text('DAILY SALES & COLLECTION REPORT', L, y, { width: W, align: 'center' });
      y += 18;

      doc.font('Helvetica').fontSize(9.5).fillColor(darkGray);
      doc.text(`Date: ${longDate}`, L, y);
      doc.text(`Ref: ${shortDate}`, L, y, { width: W, align: 'right' });
      y += 18;

      // Thin line
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor('#999999').stroke();
      y += 18;

      // ═══ SUMMARY TABLE ═══
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text('I. Financial Summary', L, y);
      y += 16;

      const summaryRows = [
        ['Gross Sales (Total Revenue)', `Rs. ${fmtINR(summary.totalRevenue)}`, `${summary.totalBills} bill${summary.totalBills !== 1 ? 's' : ''}`],
        ['Amount Collected (Paid)', `Rs. ${fmtINR(paidAmt)}`, `${paidBills.length}`],
        ['Outstanding Balance (Pending)', `Rs. ${fmtINR(pendingAmt)}`, `${pendingBills.length}`],
        ['Total Quantity Dispatched', `${Number(totalKg).toLocaleString('en-IN')} KG`, ''],
      ];

      const sColW = [W * 0.50, W * 0.30, W * 0.20];

      // Header
      const hH = 18;
      doc.rect(L, y, W, hH).lineWidth(0.5).strokeColor(black).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('Particulars', L + 8, y + 5);
      doc.text('Amount', L + sColW[0] + 8, y + 5, { width: sColW[1] - 16, align: 'right' });
      doc.text('Count', L + sColW[0] + sColW[1] + 8, y + 5, { width: sColW[2] - 16, align: 'center' });
      // Vertical lines
      doc.moveTo(L + sColW[0], y).lineTo(L + sColW[0], y + hH).stroke();
      doc.moveTo(L + sColW[0] + sColW[1], y).lineTo(L + sColW[0] + sColW[1], y + hH).stroke();
      y += hH;

      summaryRows.forEach((row) => {
        const rH = 20;
        doc.rect(L, y, W, rH).lineWidth(0.5).strokeColor(black).stroke();
        doc.moveTo(L + sColW[0], y).lineTo(L + sColW[0], y + rH).stroke();
        doc.moveTo(L + sColW[0] + sColW[1], y).lineTo(L + sColW[0] + sColW[1], y + rH).stroke();

        doc.font('Helvetica').fontSize(9).fillColor(darkGray);
        doc.text(row[0], L + 8, y + 6);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(black);
        doc.text(row[1], L + sColW[0] + 8, y + 5.5, { width: sColW[1] - 16, align: 'right' });

        if (row[2]) {
          doc.font('Helvetica').fontSize(8.5).fillColor(midGray);
          doc.text(row[2], L + sColW[0] + sColW[1] + 8, y + 6, { width: sColW[2] - 16, align: 'center' });
        }
        y += rH;
      });

      y += 22;

      // ═══ INVOICE TABLE ═══
      if (bills.length > 0) {
        if (y > doc.page.height - 200) {
          doc.addPage();
          y = 50;
        }

        doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
        doc.text('II. Invoice-wise Breakup', L, y);
        y += 16;

        const tCols = [32, 42, W - 32 - 42 - 65 - 100 - 55, 65, 100, 55];
        const tHeaders = ['S.No', 'Inv #', 'Customer Name', 'Qty (KG)', 'Amount (Rs.)', 'Status'];
        const thH = 18;

        // Draw header
        const drawHeader = () => {
          doc.rect(L, y, W, thH).lineWidth(0.5).strokeColor(black).fillAndStroke('#f0f0f0', black);
          doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
          let hx = L;
          tHeaders.forEach((h, i) => {
            const align = i >= 3 ? (i === 5 ? 'center' : 'right') : 'left';
            doc.text(h, hx + 5, y + 5.5, { width: tCols[i] - 10, align });
            // Vertical lines
            if (i > 0) doc.moveTo(hx, y).lineTo(hx, y + thH).lineWidth(0.5).strokeColor(black).stroke();
            hx += tCols[i];
          });
          y += thH;
        };

        drawHeader();

        bills.forEach((b, idx) => {
          const qty = b.items && b.items.length > 0
            ? b.items.reduce((s, it) => s + (it.quantity || 0), 0)
            : (b.quantity || 0);
          const status = b.paymentStatus || 'Pending';
          const rH = 18;

          if (y + rH > doc.page.height - 80) {
            doc.addPage();
            y = 50;
            drawHeader();
          }

          doc.rect(L, y, W, rH).lineWidth(0.5).strokeColor(black).stroke();
          let rx = L;

          // S.No
          doc.font('Helvetica').fontSize(8.5).fillColor(darkGray);
          doc.text(`${idx + 1}`, rx + 5, y + 5, { width: tCols[0] - 10, align: 'center' });
          rx += tCols[0];
          doc.moveTo(rx, y).lineTo(rx, y + rH).lineWidth(0.5).strokeColor(black).stroke();

          // Inv #
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
          doc.text(`${b.billNo}`, rx + 5, y + 5, { width: tCols[1] - 10, align: 'center' });
          rx += tCols[1];
          doc.moveTo(rx, y).lineTo(rx, y + rH).stroke();

          // Customer
          doc.font('Helvetica').fontSize(8.5).fillColor(darkGray);
          doc.text(b.companyName || '-', rx + 5, y + 5, { width: tCols[2] - 10, align: 'left' });
          rx += tCols[2];
          doc.moveTo(rx, y).lineTo(rx, y + rH).stroke();

          // Qty
          doc.font('Helvetica').fontSize(8.5).fillColor(black);
          doc.text(Number(qty).toLocaleString('en-IN'), rx + 5, y + 5, { width: tCols[3] - 10, align: 'right' });
          rx += tCols[3];
          doc.moveTo(rx, y).lineTo(rx, y + rH).stroke();

          // Amount
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
          doc.text(fmtINR(b.grandTotal || b.total), rx + 5, y + 5, { width: tCols[4] - 10, align: 'right' });
          rx += tCols[4];
          doc.moveTo(rx, y).lineTo(rx, y + rH).stroke();

          // Status
          doc.font('Helvetica').fontSize(8).fillColor(darkGray);
          doc.text(status, rx + 5, y + 5.5, { width: tCols[5] - 10, align: 'center' });

          y += rH;
        });

        // Totals
        const totH = 20;
        doc.rect(L, y, W, totH).lineWidth(0.5).strokeColor(black).fillAndStroke('#f0f0f0', black);
        let tx = L;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
        doc.text('TOTAL', tx + 5, y + 6, { width: tCols[0] + tCols[1] + tCols[2] - 10, align: 'right' });
        tx += tCols[0] + tCols[1] + tCols[2];
        doc.moveTo(tx, y).lineTo(tx, y + totH).stroke();

        doc.text(`${Number(totalKg).toLocaleString('en-IN')} KG`, tx + 5, y + 6, { width: tCols[3] - 10, align: 'right' });
        tx += tCols[3];
        doc.moveTo(tx, y).lineTo(tx, y + totH).stroke();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(black);
        doc.text(`Rs. ${fmtINR(summary.totalRevenue)}`, tx + 5, y + 5.5, { width: tCols[4] - 10, align: 'right' });
        tx += tCols[4];
        doc.moveTo(tx, y).lineTo(tx, y + totH).stroke();

        doc.font('Helvetica').fontSize(7.5).fillColor(midGray);
        doc.text(`${summary.totalBills} bills`, tx + 5, y + 6.5, { width: tCols[5] - 10, align: 'center' });
        y += totH;
      }

      // ═══ FOOTER ═══
      y = doc.page.height - 65;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor('#999999').stroke();
      y += 8;
      doc.font('Helvetica').fontSize(7.5).fillColor('#999999');
      doc.text(`Generated: ${generatedAt}`, L, y);
      doc.text('Vijaya Durga Agencies', L, y, { width: W, align: 'right' });
      y += 12;
      doc.fontSize(6.5).fillColor('#bbbbbb');
      doc.text('This is a system-generated report.', L, y, { width: W, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateDailyReportPDF };

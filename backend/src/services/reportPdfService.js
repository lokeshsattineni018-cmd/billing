const PDFDocument = require('pdfkit');

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate formal Financial & Sales Report PDF for any date range
 */
async function generatePeriodReportPDF({ bills = [], summary = {}, topBuyers = [], itemsAgg = [], dateRange = {}, settings = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Financial Report - ${dateRange.label || 'Summary'}`,
          Author: 'VIJAYA DURGA AGENCIES',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const L = 40;
      const R = doc.page.width - 40;
      const W = R - L;
      const black = '#000000';
      const darkGray = '#333333';
      const midGray = '#666666';
      const lightGray = '#f5f5f5';
      const borderGray = '#cccccc';

      let y = 40;

      const startDateStr = dateRange.start ? new Date(dateRange.start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const endDateStr = dateRange.end ? new Date(dateRange.end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const periodStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;
      const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

      // ═══ COMPANY HEADER ═══
      doc.font('Helvetica-Bold').fontSize(16).fillColor(black);
      doc.text(settings.businessName || 'VIJAYA DURGA AGENCIES', L, y);
      y += 18;

      doc.font('Helvetica').fontSize(8.5).fillColor(midGray);
      doc.text(settings.address || 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, West Godavari Dist., A.P.', L, y);
      y += 11;
      doc.text(`Cell: ${settings.phone || '9441429745'}   |   GSTIN: ${settings.gstin || '37KATPS1500Q1ZR'}`, L, y);
      y += 14;

      // Double line
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(black).stroke();
      doc.moveTo(L, y + 2.5).lineTo(R, y + 2.5).lineWidth(0.5).strokeColor(black).stroke();
      y += 12;

      // ═══ REPORT TITLE & DATES ═══
      doc.font('Helvetica-Bold').fontSize(13).fillColor(black);
      doc.text('FINANCIAL & SALES SUMMARY REPORT', L, y, { width: W, align: 'center' });
      y += 16;

      doc.font('Helvetica').fontSize(9).fillColor(darkGray);
      doc.text(`Report Period: ${periodStr} (${dateRange.label || 'PERIOD'})   |   Generated: ${generatedAt}`, L, y, { width: W, align: 'center' });
      y += 18;

      // ═══ SECTION I: FINANCIAL SUMMARY TABLE ═══
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text('I. FINANCIAL KEY PERFORMANCE INDICATORS', L, y);
      y += 14;

      const summaryBoxY = y;
      doc.rect(L, summaryBoxY, W, 70).lineWidth(0.8).strokeColor(black).stroke();

      // Row 1
      const colW = W / 4;
      doc.rect(L, summaryBoxY, W, 35).fillColor(lightGray).fill();
      doc.moveTo(L, summaryBoxY + 35).lineTo(R, summaryBoxY + 35).lineWidth(0.5).strokeColor(borderGray).stroke();
      [1, 2, 3].forEach((i) => {
        doc.moveTo(L + colW * i, summaryBoxY).lineTo(L + colW * i, summaryBoxY + 70).lineWidth(0.5).strokeColor(borderGray).stroke();
      });

      // Headers Row 1
      doc.font('Helvetica').fontSize(7.5).fillColor(midGray);
      doc.text('GROSS SALES REVENUE', L + 6, summaryBoxY + 5, { width: colW - 12 });
      doc.text('COLLECTED (PAID)', L + colW + 6, summaryBoxY + 5, { width: colW - 12 });
      doc.text('OUTSTANDING BALANCE', L + colW * 2 + 6, summaryBoxY + 5, { width: colW - 12 });
      doc.text('TOTAL INVOICES', L + colW * 3 + 6, summaryBoxY + 5, { width: colW - 12 });

      // Values Row 1
      doc.font('Helvetica-Bold').fontSize(11).fillColor(black);
      doc.text(`Rs. ${fmtINR(summary.totalRevenue || 0)}`, L + 6, summaryBoxY + 18, { width: colW - 12 });
      doc.text(`Rs. ${fmtINR(summary.paidAmount || 0)}`, L + colW + 6, summaryBoxY + 18, { width: colW - 12 });
      doc.text(`Rs. ${fmtINR(summary.pendingAmount || 0)}`, L + colW * 2 + 6, summaryBoxY + 18, { width: colW - 12 });
      doc.text(`${summary.totalBills || bills.length || 0}`, L + colW * 3 + 6, summaryBoxY + 18, { width: colW - 12 });

      // Row 2 Labels
      doc.font('Helvetica').fontSize(7.5).fillColor(midGray);
      doc.text('TAXABLE VALUE', L + 6, summaryBoxY + 40, { width: colW - 12 });
      doc.text('TOTAL GST COLLECTED', L + colW + 6, summaryBoxY + 40, { width: colW - 12 });
      doc.text('AVG TICKET SIZE', L + colW * 2 + 6, summaryBoxY + 40, { width: colW - 12 });
      doc.text('STATUS RATIO', L + colW * 3 + 6, summaryBoxY + 40, { width: colW - 12 });

      // Values Row 2
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text(`Rs. ${fmtINR(summary.totalTaxable || 0)}`, L + 6, summaryBoxY + 52, { width: colW - 12 });
      doc.text(`Rs. ${fmtINR(summary.totalTax || 0)}`, L + colW + 6, summaryBoxY + 52, { width: colW - 12 });
      doc.text(`Rs. ${fmtINR(summary.avgTicketSize || 0)}`, L + colW * 2 + 6, summaryBoxY + 52, { width: colW - 12 });
      doc.text(`${summary.paidCount || 0} Paid / ${summary.pendingCount || 0} Unpaid`, L + colW * 3 + 6, summaryBoxY + 52, { width: colW - 12 });

      y = summaryBoxY + 84;

      // ═══ SECTION II: TOP BUYERS (if present) ═══
      if (topBuyers && topBuyers.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
        doc.text('II. TOP CLIENTS BY REVENUE', L, y);
        y += 12;

        const buyerCols = [
          { label: '#', w: 25, align: 'left' },
          { label: 'Client / Company Name', w: 230, align: 'left' },
          { label: 'Phone', w: 85, align: 'left' },
          { label: 'Bills', w: 45, align: 'center' },
          { label: 'Total Revenue', w: 130, align: 'right' },
        ];

        // Header
        doc.rect(L, y, W, 16).fillColor(lightGray).fill();
        doc.rect(L, y, W, 16).lineWidth(0.5).strokeColor(borderGray).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(black);

        let curX = L;
        buyerCols.forEach((col) => {
          doc.text(col.label, curX + 4, y + 4, { width: col.w - 8, align: col.align });
          curX += col.w;
        });
        y += 16;

        topBuyers.slice(0, 5).forEach((tb, idx) => {
          doc.font('Helvetica').fontSize(8).fillColor(darkGray);
          doc.rect(L, y, W, 15).lineWidth(0.3).strokeColor(borderGray).stroke();

          curX = L;
          doc.text(String(idx + 1), curX + 4, y + 4, { width: buyerCols[0].w - 8, align: buyerCols[0].align });
          curX += buyerCols[0].w;

          doc.text(tb._id || 'Direct Buyer', curX + 4, y + 4, { width: buyerCols[1].w - 8, align: buyerCols[1].align });
          curX += buyerCols[1].w;

          doc.text(tb.phone || '—', curX + 4, y + 4, { width: buyerCols[2].w - 8, align: buyerCols[2].align });
          curX += buyerCols[2].w;

          doc.text(String(tb.billCount || 1), curX + 4, y + 4, { width: buyerCols[3].w - 8, align: buyerCols[3].align });
          curX += buyerCols[3].w;

          doc.font('Helvetica-Bold');
          doc.text(`Rs. ${fmtINR(tb.totalSales || 0)}`, curX + 4, y + 4, { width: buyerCols[4].w - 8, align: buyerCols[4].align });

          y += 15;
        });

        y += 16;
      }

      // Check if space left for invoices table, else page break
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 40;
      }

      // ═══ SECTION III: INVOICES BREAKDOWN ═══
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text(`III. ITEMIZED INVOICE REGISTER (${bills.length} Invoices)`, L, y);
      y += 12;

      const invCols = [
        { label: 'Inv #', w: 45, align: 'left' },
        { label: 'Date', w: 65, align: 'left' },
        { label: 'Buyer Name', w: 180, align: 'left' },
        { label: 'Taxable', w: 75, align: 'right' },
        { label: 'Grand Total', w: 85, align: 'right' },
        { label: 'Status', w: 65, align: 'center' },
      ];

      // Header row
      const drawInvHeader = () => {
        doc.rect(L, y, W, 16).fillColor(lightGray).fill();
        doc.rect(L, y, W, 16).lineWidth(0.5).strokeColor(borderGray).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(black);

        let hX = L;
        invCols.forEach((col) => {
          doc.text(col.label, hX + 4, y + 4, { width: col.w - 8, align: col.align });
          hX += col.w;
        });
        y += 16;
      };

      drawInvHeader();

      bills.forEach((b) => {
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = 40;
          drawInvHeader();
        }

        doc.rect(L, y, W, 15).lineWidth(0.3).strokeColor(borderGray).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(darkGray);

        let rowX = L;
        // Inv No
        const invNoStr = `#${b.formattedBillNo || b.billNumber || b.billNo}`;
        doc.text(invNoStr, rowX + 4, y + 4, { width: invCols[0].w - 8, align: invCols[0].align });
        rowX += invCols[0].w;

        // Date
        const dStr = b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
        doc.text(dStr, rowX + 4, y + 4, { width: invCols[1].w - 8, align: invCols[1].align });
        rowX += invCols[1].w;

        // Buyer Name
        const comp = (b.companyName || 'Cash Sale').substring(0, 32);
        doc.text(comp, rowX + 4, y + 4, { width: invCols[2].w - 8, align: invCols[2].align });
        rowX += invCols[2].w;

        // Taxable
        const taxable = b.taxableValue || b.total || 0;
        doc.text(fmtINR(taxable), rowX + 4, y + 4, { width: invCols[3].w - 8, align: invCols[3].align });
        rowX += invCols[3].w;

        // Grand Total
        const gTot = b.grandTotal || b.total || 0;
        doc.font('Helvetica-Bold');
        doc.text(fmtINR(gTot), rowX + 4, y + 4, { width: invCols[4].w - 8, align: invCols[4].align });
        doc.font('Helvetica');
        rowX += invCols[4].w;

        // Status
        const st = b.paymentStatus || 'Pending';
        doc.text(st, rowX + 4, y + 4, { width: invCols[5].w - 8, align: invCols[5].align });

        y += 15;
      });

      // Total Row
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }
      doc.rect(L, y, W, 18).fillColor(lightGray).fill();
      doc.rect(L, y, W, 18).lineWidth(0.8).strokeColor(black).stroke();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text('TOTAL REVENUE:', L + 10, y + 5);
      doc.text(`Rs. ${fmtINR(summary.totalRevenue || 0)}`, L + 320, y + 5, { width: 150, align: 'right' });

      // Add page numbers on all buffered pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(7.5).fillColor(midGray);
        doc.text(
          `Page ${i + 1} of ${pageCount}   |   Vijaya Durga Agencies Billing System   |   Confidential`,
          L,
          doc.page.height - 25,
          { width: W, align: 'center' }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePeriodReportPDF };

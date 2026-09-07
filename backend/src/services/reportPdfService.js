const PDFDocument = require('pdfkit');

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate an Official Government-Standard Financial & GST Sales Audit Statement PDF
 * (Consolidated Outward Supply & Tax Ledger for any selected date range)
 */
async function generatePeriodReportPDF({ bills = [], summary = {}, topBuyers = [], itemsAgg = [], dateRange = {}, settings = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `GST & Financial Audit Statement - ${dateRange.label || 'Summary'}`,
          Author: settings.businessName || 'VIJAYA DURGA AGENCIES',
          Subject: 'Statutory Financial & GST Outward Supplies Audit Statement',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const L = 28;
      const R = doc.page.width - 28;
      const W = R - L; // 539.28 pt

      const black = '#000000';
      const textMuted = '#374151';
      const lightBg = '#f1f5f9';
      const lineW = 0.65;

      let y = 28;

      const startDateStr = dateRange.start ? new Date(dateRange.start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const endDateStr = dateRange.end ? new Date(dateRange.end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const periodStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;
      const generatedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const validBills = bills.filter((b) => !b.isVoided);
      const voidedBills = bills.filter((b) => b.isVoided);

      // ══════════════════════════════════════════════════════════════════════
      // 1. STATUTORY DOCUMENT HEADER (GOVERNMENT AUDIT LEDGER FORMAT)
      // ══════════════════════════════════════════════════════════════════════
      const headerH = 72;
      doc.rect(L, y, W, headerH).lineWidth(lineW).strokeColor(black).stroke();

      // Title Banner
      const titleH = 24;
      doc.rect(L, y, W, titleH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(11.5).fillColor(black);
      doc.text('CONSOLIDATED STATEMENT OF OUTWARD SUPPLIES & GST TURNOVER', L, y + 4.5, {
        width: W,
        align: 'center',
        characterSpacing: 0.8,
      });

      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(textMuted);
      doc.text('(Official Financial & Tax Audit Statement - Maintained under the Provisions of the Goods and Services Tax Act, 2017)', L, y + 16, {
        width: W,
        align: 'center',
      });

      // Business & Statement Metadata
      const metaY = y + titleH + 4;
      const halfW = W / 2;

      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text(settings.businessName || 'VIJAYA DURGA AGENCIES', L + 6, metaY);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text(`Prop: ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}`, L + 6, metaY + 12);

      const gstin = settings.gstin || '37KATPS1500Q1ZR';
      const pan = gstin.length >= 12 ? gstin.substring(2, 12) : 'KATPS1500Q';
      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(`GSTIN: ${gstin}   |   PAN: ${pan}   |   State: Andhra Pradesh (37)`, L + 6, metaY + 23);

      // Right Side: Period details
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text('STATEMENT PERIOD :', L + halfW, metaY);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text(`${periodStr}`, L + halfW + 90, metaY, { width: halfW - 96 });

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('TOTAL INVOICES :', L + halfW, metaY + 12);
      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(`${validBills.length} Active ${voidedBills.length > 0 ? `(${voidedBills.length} Voided)` : ''}`, L + halfW + 90, metaY + 12);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('REPORT GENERATED :', L + halfW, metaY + 23);
      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(generatedAt, L + halfW + 90, metaY + 23);

      y += headerH;

      // ══════════════════════════════════════════════════════════════════════
      // 2. FINANCIAL PERFORMANCE & GST LIABILITY MATRIX (8-QUADRANT GRID)
      // ══════════════════════════════════════════════════════════════════════
      const matrixH = 50;
      doc.rect(L, y, W, matrixH).lineWidth(lineW).strokeColor(black).stroke();

      const quadW = W / 4;
      doc.moveTo(L + quadW, y).lineTo(L + quadW, y + matrixH).stroke();
      doc.moveTo(L + quadW * 2, y).lineTo(L + quadW * 2, y + matrixH).stroke();
      doc.moveTo(L + quadW * 3, y).lineTo(L + quadW * 3, y + matrixH).stroke();
      doc.moveTo(L, y + 25).lineTo(R, y + 25).stroke();

      const totalTax = (summary.totalTax || (summary.totalCGST || 0) + (summary.totalSGST || 0) + (summary.totalIGST || 0));

      const matrixData = [
        { l: 'GROSS TURNOVER (SALES)', v: `Rs. ${fmtINR(summary.totalRevenue || 0)}`, bold: true },
        { l: 'TAXABLE VALUE', v: `Rs. ${fmtINR(summary.totalTaxable || 0)}`, bold: false },
        { l: 'TOTAL GST TAX LIABILITY', v: `Rs. ${fmtINR(totalTax)}`, bold: true },
        { l: 'AVG TICKET SIZE', v: `Rs. ${fmtINR(summary.avgTicketSize || 0)}`, bold: false },

        { l: 'REALIZED COLLECTIONS (PAID)', v: `Rs. ${fmtINR(summary.paidAmount || 0)}`, bold: true },
        { l: 'OUTSTANDING RECEIVABLES', v: `Rs. ${fmtINR(summary.pendingAmount || 0)}`, bold: true },
        { l: 'SETTLEMENT RATIO', v: `${summary.paidCount || 0} Paid / ${summary.pendingCount || 0} Due`, bold: false },
        { l: 'TAX RATE (CGST / SGST)', v: `2.5% CGST + 2.5% SGST`, bold: false },
      ];

      matrixData.forEach((c, i) => {
        const colIdx = i % 4;
        const rowIdx = Math.floor(i / 4);
        const cX = L + quadW * colIdx;
        const cY = y + rowIdx * 25;

        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(textMuted);
        doc.text(c.l, cX + 6, cY + 4, { width: quadW - 12 });

        doc.font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(black);
        doc.text(c.v, cX + 6, cY + 13, { width: quadW - 12 });
      });

      y += matrixH;

      // ══════════════════════════════════════════════════════════════════════
      // 3. GST CATEGORY BREAKDOWN (B2B REGISTERED VS B2C UNREGISTERED)
      // ══════════════════════════════════════════════════════════════════════
      const catH = 46;
      doc.rect(L, y, W, catH).lineWidth(lineW).strokeColor(black).stroke();

      const b2bBills = validBills.filter((b) => b.companyGstin && b.companyGstin.trim().length >= 10);
      const b2cBills = validBills.filter((b) => !b.companyGstin || b.companyGstin.trim().length < 10);

      const b2bTaxable = b2bBills.reduce((s, b) => s + (b.taxableValue || b.total || 0), 0);
      const b2bTax = b2bBills.reduce((s, b) => s + (b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0), 0);
      const b2bTotal = b2bBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

      const b2cTaxable = b2cBills.reduce((s, b) => s + (b.taxableValue || b.total || 0), 0);
      const b2cTax = b2cBills.reduce((s, b) => s + (b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0), 0);
      const b2cTotal = b2cBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

      const catColW = [160, 55, 105, 105, 114.28];
      const catThH = 15;
      doc.rect(L, y, W, catThH).fillAndStroke(lightBg, black);

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
      let catX = L;
      const catHeaders = ['SUPPLY CLASSIFICATION (GST RULES)', 'INVOICES', 'TAXABLE VALUE (Rs.)', 'GST COLLECTED (Rs.)', 'TOTAL VALUE (Rs.)'];
      catHeaders.forEach((h, idx) => {
        if (idx > 0) doc.moveTo(catX, y).lineTo(catX, y + catH).stroke();
        doc.text(h, catX + 2, y + 4.5, { width: catColW[idx] - 4, align: idx >= 2 ? 'right' : (idx === 1 ? 'center' : 'left') });
        catX += catColW[idx];
      });

      // B2B Row
      let rY = y + catThH;
      const rH = 15;
      doc.moveTo(L, rY).lineTo(R, rY).stroke();
      catX = L;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('Table 4: B2B Registered Persons', catX + 4, rY + 4, { width: catColW[0] - 8 });
      catX += catColW[0];
      doc.font('Helvetica').fontSize(7.5);
      doc.text(String(b2bBills.length), catX + 2, rY + 4, { width: catColW[1] - 4, align: 'center' });
      catX += catColW[1];
      doc.text(fmtINR(b2bTaxable), catX + 2, rY + 4, { width: catColW[2] - 6, align: 'right' });
      catX += catColW[2];
      doc.text(fmtINR(b2bTax), catX + 2, rY + 4, { width: catColW[3] - 6, align: 'right' });
      catX += catColW[3];
      doc.font('Helvetica-Bold');
      doc.text(fmtINR(b2bTotal), catX + 2, rY + 4, { width: catColW[4] - 6, align: 'right' });

      // B2C Row
      rY += rH;
      doc.moveTo(L, rY).lineTo(R, rY).stroke();
      catX = L;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('Table 7: B2C Unregistered / Consumers', catX + 4, rY + 4, { width: catColW[0] - 8 });
      catX += catColW[0];
      doc.font('Helvetica').fontSize(7.5);
      doc.text(String(b2cBills.length), catX + 2, rY + 4, { width: catColW[1] - 4, align: 'center' });
      catX += catColW[1];
      doc.text(fmtINR(b2cTaxable), catX + 2, rY + 4, { width: catColW[2] - 6, align: 'right' });
      catX += catColW[2];
      doc.text(fmtINR(b2cTax), catX + 2, rY + 4, { width: catColW[3] - 6, align: 'right' });
      catX += catColW[3];
      doc.font('Helvetica-Bold');
      doc.text(fmtINR(b2cTotal), catX + 2, rY + 4, { width: catColW[4] - 6, align: 'right' });

      y += catH;

      // ══════════════════════════════════════════════════════════════════════
      // 4. TOP BUYERS LEDGER (IF PRESENT)
      // ══════════════════════════════════════════════════════════════════════
      if (topBuyers && topBuyers.length > 0) {
        const topSecH = 15;
        doc.rect(L, y, W, topSecH).fillAndStroke(lightBg, black);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text('TOP BUYERS SUMMARY (BY TAXABLE TURNOVER)', L + 6, y + 4);
        y += topSecH;

        const bCols = [
          { label: 'Sl.', w: 26, align: 'center' },
          { label: 'Client / Buyer Name', w: 190, align: 'left' },
          { label: 'Buyer GSTIN', w: 100, align: 'center' },
          { label: 'Invoices', w: 45, align: 'center' },
          { label: 'Total Turnover (Rs.)', w: 100, align: 'right' },
          { label: 'Share', w: 78.28, align: 'right' },
        ];

        const bThH = 15;
        doc.rect(L, y, W, bThH).fillAndStroke(lightBg, black);
        let bX = L;
        bCols.forEach((col, idx) => {
          if (idx > 0) doc.moveTo(bX, y).lineTo(bX, y + bThH).stroke();
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
          doc.text(col.label, bX + 2, y + 4.5, { width: col.w - 4, align: col.align });
          bX += col.w;
        });
        y += bThH;

        const grandTot = summary.totalRevenue || 1;
        topBuyers.slice(0, 5).forEach((tb, idx) => {
          const rowH = 15;
          doc.rect(L, y, W, rowH).lineWidth(lineW).strokeColor(black).stroke();

          const share = Math.round(((tb.totalSales || 0) / grandTot) * 100);
          bX = L;

          // Sl
          doc.font('Helvetica').fontSize(7.5).fillColor(black);
          doc.text(String(idx + 1), bX + 2, y + 4, { width: bCols[0].w - 4, align: 'center' });
          bX += bCols[0].w;
          doc.moveTo(bX, y).lineTo(bX, y + rowH).stroke();

          // Name
          doc.font('Helvetica-Bold').fontSize(7.5);
          doc.text(tb._id || 'Direct Buyer', bX + 4, y + 4, { width: bCols[1].w - 8, align: 'left' });
          bX += bCols[1].w;
          doc.moveTo(bX, y).lineTo(bX, y + rowH).stroke();

          // GSTIN
          doc.font('Helvetica').fontSize(7).fillColor(textMuted);
          doc.text(tb.gstin || 'URP', bX + 2, y + 4, { width: bCols[2].w - 4, align: 'center' });
          bX += bCols[2].w;
          doc.moveTo(bX, y).lineTo(bX, y + rowH).stroke();

          // Invoices
          doc.font('Helvetica').fontSize(7.5).fillColor(black);
          doc.text(String(tb.billCount || 1), bX + 2, y + 4, { width: bCols[3].w - 4, align: 'center' });
          bX += bCols[3].w;
          doc.moveTo(bX, y).lineTo(bX, y + rowH).stroke();

          // Total
          doc.font('Helvetica-Bold');
          doc.text(fmtINR(tb.totalSales || 0), bX + 2, y + 4, { width: bCols[4].w - 6, align: 'right' });
          bX += bCols[4].w;
          doc.moveTo(bX, y).lineTo(bX, y + rowH).stroke();

          // Share
          doc.font('Helvetica').fontSize(7);
          doc.text(`${share}%`, bX + 2, y + 4, { width: bCols[5].w - 6, align: 'right' });

          y += rowH;
        });
      }

      // Check space for invoice register
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 28;
      }

      // ══════════════════════════════════════════════════════════════════════
      // 5. ITEMIZED INVOICE AUDIT REGISTER (SCHEDULE OF INVOICES)
      // ══════════════════════════════════════════════════════════════════════
      const invSecH = 15;
      doc.rect(L, y, W, invSecH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`ITEMIZED OUTWARD INVOICE REGISTER (${validBills.length} RECORDS)`, L + 6, y + 4);
      y += invSecH;

      const invCols = [
        { label: 'Inv #', w: 68, align: 'center' },
        { label: 'Date', w: 52, align: 'center' },
        { label: 'Buyer / Consignee', w: 142, align: 'left' },
        { label: 'Buyer GSTIN', w: 84, align: 'center' },
        { label: 'Taxable (Rs.)', w: 62, align: 'right' },
        { label: 'GST Tax (Rs.)', w: 56, align: 'right' },
        { label: 'Total (Rs.)', w: 75.28, align: 'right' },
      ];

      const drawInvHeader = () => {
        const thH = 15;
        doc.rect(L, y, W, thH).fillAndStroke(lightBg, black);
        let hX = L;
        invCols.forEach((col, idx) => {
          if (idx > 0) doc.moveTo(hX, y).lineTo(hX, y + thH).stroke();
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
          doc.text(col.label, hX + 2, y + 4, { width: col.w - 4, align: col.align });
          hX += col.w;
        });
        y += thH;
      };

      drawInvHeader();

      validBills.forEach((b) => {
        const rowH = 15;
        if (y + rowH > doc.page.height - 100) {
          doc.addPage();
          y = 28;
          drawInvHeader();
        }

        doc.rect(L, y, W, rowH).lineWidth(lineW).strokeColor(black).stroke();

        const invNo = b.formattedBillNo || b.billNo;
        const dStr = b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
        const taxable = b.taxableValue || b.total || 0;
        const gst = (b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0);
        const gTot = b.grandTotal || b.total || 0;

        let rX = L;
        // Inv #
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text(`#${invNo}`, rX + 2, y + 4, { width: invCols[0].w - 4, align: 'center' });
        rX += invCols[0].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // Date
        doc.font('Helvetica').fontSize(7.5);
        doc.text(dStr, rX + 2, y + 4, { width: invCols[1].w - 4, align: 'center' });
        rX += invCols[1].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // Buyer Name
        doc.text((b.companyName || 'Cash Sale').substring(0, 26), rX + 4, y + 4, { width: invCols[2].w - 8, align: 'left' });
        rX += invCols[2].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // GSTIN
        doc.font('Helvetica').fontSize(7).fillColor(textMuted);
        doc.text(b.companyGstin || 'URP', rX + 2, y + 4, { width: invCols[3].w - 4, align: 'center' });
        rX += invCols[3].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // Taxable
        doc.font('Helvetica').fontSize(7.5).fillColor(black);
        doc.text(taxable.toFixed(2), rX + 2, y + 4, { width: invCols[4].w - 4, align: 'right' });
        rX += invCols[4].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // GST
        doc.text(gst.toFixed(2), rX + 2, y + 4, { width: invCols[5].w - 4, align: 'right' });
        rX += invCols[5].w;
        doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

        // Total
        doc.font('Helvetica-Bold');
        doc.text(gTot.toFixed(2), rX + 2, y + 4, { width: invCols[6].w - 4, align: 'right' });

        y += rowH;
      });

      // Total Row for Itemized Invoices
      const totH = 17;
      if (y + totH > doc.page.height - 100) {
        doc.addPage();
        y = 28;
      }
      const sumLabelW = invCols[0].w + invCols[1].w + invCols[2].w + invCols[3].w;
      doc.rect(L, y, sumLabelW, totH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('TOTAL AUDIT TURNOVER :', L + 4, y + 4.5, { width: sumLabelW - 8, align: 'right' });

      let tX = L + sumLabelW;
      doc.rect(tX, y, invCols[4].w, totH).fillAndStroke(lightBg, black);
      doc.text(fmtINR(summary.totalTaxable || 0), tX + 2, y + 4.5, { width: invCols[4].w - 4, align: 'right' });
      tX += invCols[4].w;

      doc.rect(tX, y, invCols[5].w, totH).fillAndStroke(lightBg, black);
      doc.text(fmtINR(totalTax), tX + 2, y + 4.5, { width: invCols[5].w - 4, align: 'right' });
      tX += invCols[5].w;

      doc.rect(tX, y, invCols[6].w, totH).fillAndStroke(lightBg, black);
      doc.text(fmtINR(summary.totalRevenue || 0), tX + 2, y + 4.5, { width: invCols[6].w - 4, align: 'right' });

      y += totH + 12;

      // ══════════════════════════════════════════════════════════════════════
      // 6. STATUTORY CERTIFICATION & ATTESTATION BLOCK
      // ══════════════════════════════════════════════════════════════════════
      const signBoxH = 68;
      if (y + signBoxH > doc.page.height - 40) {
        doc.addPage();
        y = 28;
      }

      const signLeftW = Math.floor(W * 0.58);
      const signRightW = W - signLeftW;

      doc.rect(L, y, signLeftW, signBoxH).lineWidth(lineW).strokeColor(black).stroke();
      doc.rect(L + signLeftW, y, signRightW, signBoxH).lineWidth(lineW).strokeColor(black).stroke();

      // Left Box
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('STATUTORY DECLARATION & AUDIT ENDORSEMENT:', L + 6, y + 5);

      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted);
      doc.text(
        'Certified that this consolidated statement reflects the true and accurate record of outward supplies, taxable turnover, tax collected, and receivables for the specified period as per the books of accounts maintained under the Goods and Services Tax Act, 2017.',
        L + 6,
        y + 15,
        { width: signLeftW - 12, lineGap: 1.5 }
      );

      doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
      doc.text('Generated electronically from verified trade invoices.', L + 6, y + 53);

      // Right Box: Signatures
      const sX = L + signLeftW;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text(`For ${settings.businessName || 'VIJAYA DURGA AGENCIES'}`, sX + 6, y + 6, {
        width: signRightW - 12,
        align: 'center',
      });

      doc.font('Helvetica-Oblique').fontSize(6).fillColor('#94a3b8');
      doc.text('[ Signature / Official Seal ]', sX + 6, y + signBoxH - 26, {
        width: signRightW - 12,
        align: 'center',
      });

      doc.moveTo(sX + 24, y + signBoxH - 15).lineTo(sX + signRightW - 24, y + signBoxH - 15).strokeColor(black).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('PROPRIETOR / AUTHORISED SIGNATORY', sX + 6, y + signBoxH - 12, {
        width: signRightW - 12,
        align: 'center',
      });

      // Add Page Numbers on all buffered pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
        doc.text(
          `Page ${i + 1} of ${pageCount}   |   Statutory Audit Statement of Outward Supplies   |   Vijaya Durga Agencies`,
          L,
          doc.page.height - 20,
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

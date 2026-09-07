const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate an Official Government-Standard Daily Revenue, Dispatch & GST Register PDF
 * (Prescribed format under Rule 56 of the CGST Rules, 2017)
 */
async function generateDailyReportPDF({ date, bills = [], summary = {}, settings: customSettings }) {
  return new Promise(async (resolve, reject) => {
    try {
      let settings = customSettings;
      if (!settings) {
        try {
          settings = await Settings.findOne().lean();
        } catch (e) {
          settings = null;
        }
      }
      if (!settings) {
        settings = {
          businessName: 'VIJAYA DURGA AGENCIES',
          legalName: 'SATTINENI VENKATA DHANA LAXMI',
          address: 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
          phone: '9441429745',
          gstin: '37KATPS1500Q1ZR',
        };
      }

      const reportDate = new Date(date);
      const dd = String(reportDate.getDate()).padStart(2, '0');
      const mm = String(reportDate.getMonth() + 1).padStart(2, '0');
      const yyyy = reportDate.getFullYear();
      const dateFormatted = `${dd}-${mm}-${yyyy}`;
      const weekday = reportDate.toLocaleDateString('en-IN', { weekday: 'long' });
      const generatedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `Statutory Daily Register - ${dateFormatted}`,
          Author: settings.businessName || 'VIJAYA DURGA AGENCIES',
          Subject: 'Statutory Daily Outward Supply & GST Collection Register',
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
      const textDark = '#111827';
      const textMuted = '#374151';
      const lightBg = '#f1f5f9';
      const lineW = 0.65;

      let y = 28;

      // Filter active (non-voided) bills
      const validBills = bills.filter((b) => !b.isVoided);
      const voidedBills = bills.filter((b) => b.isVoided);
      const paidBills = validBills.filter((b) => b.paymentStatus === 'Paid');
      const pendingBills = validBills.filter((b) => b.paymentStatus !== 'Paid');

      const totalRevenue = validBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
      const totalTaxable = validBills.reduce((s, b) => s + (b.taxableValue || b.total || 0), 0);
      const totalCGST = validBills.reduce((s, b) => s + (b.cgstAmount || 0), 0);
      const totalSGST = validBills.reduce((s, b) => s + (b.sgstAmount || 0), 0);
      const totalIGST = validBills.reduce((s, b) => s + (b.igstAmount || 0), 0);
      const totalGST = totalCGST + totalSGST + totalIGST;
      const paidAmt = paidBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
      const pendingAmt = pendingBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

      const totalKg = validBills.reduce((s, b) => {
        if (b.items && b.items.length > 0) return s + b.items.reduce((ss, it) => ss + (it.quantity || 0), 0);
        return s + (b.quantity || 0);
      }, 0);

      // ══════════════════════════════════════════════════════════════════════
      // 1. STATUTORY DOCUMENT HEADER (RULE 56 REGISTER)
      // ══════════════════════════════════════════════════════════════════════
      const headerBoxH = 68;
      doc.rect(L, y, W, headerBoxH).lineWidth(lineW).strokeColor(black).stroke();

      // Header Banner
      const titleBannerH = 22;
      doc.rect(L, y, W, titleBannerH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(black);
      doc.text('DAILY OUTWARD SUPPLY, REVENUE & GST REGISTER', L, y + 4.5, {
        width: W,
        align: 'center',
        characterSpacing: 0.8,
      });

      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(textMuted);
      doc.text('(Maintained under Section 35 of CGST Act, 2017 read with Rule 56 of CGST Rules, 2017 - Daily Outward Tax Register)', L, y + 14, {
        width: W,
        align: 'center',
      });

      // Business Meta Grid inside Header
      const metaY = y + titleBannerH + 4;
      const halfW = W / 2;

      doc.font('Helvetica-Bold').fontSize(10).fillColor(black);
      doc.text(settings.businessName || 'VIJAYA DURGA AGENCIES', L + 6, metaY);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text(`Prop: ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}`, L + 6, metaY + 12);

      const gstin = settings.gstin || '37KATPS1500Q1ZR';
      const pan = gstin.length >= 12 ? gstin.substring(2, 12) : 'KATPS1500Q';
      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(`GSTIN: ${gstin}   |   PAN: ${pan}   |   State: Andhra Pradesh (37)`, L + 6, metaY + 23);

      // Right Side: Date & Ref Info
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text('REGISTER DATE :', L + halfW, metaY);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text(`${dateFormatted} (${weekday})`, L + halfW + 80, metaY, { width: halfW - 86 });

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('REGISTER REF :', L + halfW, metaY + 12);
      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(`DRR/${yyyy}${mm}${dd}`, L + halfW + 80, metaY + 12);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('GENERATED AT :', L + halfW, metaY + 23);
      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(generatedAt, L + halfW + 80, metaY + 23);

      y += headerBoxH;

      // ══════════════════════════════════════════════════════════════════════
      // 2. DAILY FINANCIAL & REVENUE CONTROL SUMMARY (OFFICIAL MATRIX)
      // ══════════════════════════════════════════════════════════════════════
      const matrixH = 50;
      doc.rect(L, y, W, matrixH).lineWidth(lineW).strokeColor(black).stroke();

      const quadW = W / 4;
      // Vertical grid dividers
      doc.moveTo(L + quadW, y).lineTo(L + quadW, y + matrixH).stroke();
      doc.moveTo(L + quadW * 2, y).lineTo(L + quadW * 2, y + matrixH).stroke();
      doc.moveTo(L + quadW * 3, y).lineTo(L + quadW * 3, y + matrixH).stroke();
      // Horizontal grid divider
      doc.moveTo(L, y + 25).lineTo(R, y + 25).stroke();

      const matrixCells = [
        { label: 'GROSS OUTWARD TURNOVER', val: `Rs. ${fmtINR(totalRevenue)}`, bold: true },
        { label: 'TAXABLE VALUE (TURNOVER)', val: `Rs. ${fmtINR(totalTaxable)}`, bold: false },
        { label: 'TOTAL GST LIABILITY (Rs.)', val: `Rs. ${fmtINR(totalGST)}`, bold: true },
        { label: 'QUANTITY DISPATCHED', val: `${Number(totalKg).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`, bold: false },

        { label: 'REALIZED COLLECTIONS (PAID)', val: `Rs. ${fmtINR(paidAmt)}`, bold: true },
        { label: 'OUTSTANDING RECEIVABLES', val: `Rs. ${fmtINR(pendingAmt)}`, bold: true },
        { label: 'TOTAL INVOICES ISSUED', val: `${validBills.length} Valid ${voidedBills.length > 0 ? `(+${voidedBills.length} Void)` : ''}`, bold: false },
        { label: 'COLLECTION RATIO', val: `${totalRevenue > 0 ? Math.round((paidAmt / totalRevenue) * 100) : 0}% Realized`, bold: false },
      ];

      matrixCells.forEach((c, i) => {
        const colIdx = i % 4;
        const rowIdx = Math.floor(i / 4);
        const cX = L + quadW * colIdx;
        const cY = y + rowIdx * 25;

        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(textMuted);
        doc.text(c.label, cX + 6, cY + 4, { width: quadW - 12 });

        doc.font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(black);
        doc.text(c.val, cX + 6, cY + 13, { width: quadW - 12 });
      });

      y += matrixH;

      // ══════════════════════════════════════════════════════════════════════
      // 3. ITEM-WISE DAILY OUTWARD INVOICE REGISTER TABLE
      // ══════════════════════════════════════════════════════════════════════
      const secH = 15;
      doc.rect(L, y, W, secH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`RECORD OF OUTWARD INVOICES ISSUED ON ${dateFormatted} (${validBills.length} TRANSACTIONS)`, L + 6, y + 4);

      y += secH;

      const cols = [
        { label: 'Sl.', w: 22, align: 'center' },
        { label: 'Inv #', w: 68, align: 'center' },
        { label: 'Buyer Name & Consignee', w: 142, align: 'left' },
        { label: 'Buyer GSTIN', w: 84, align: 'center' },
        { label: 'Qty (KG)', w: 48, align: 'right' },
        { label: 'Taxable (Rs.)', w: 58, align: 'right' },
        { label: 'GST (Rs.)', w: 48, align: 'right' },
        { label: 'Total (Rs.)', w: 69.28, align: 'right' },
      ];

      // Draw table header row
      const thH = 16;
      doc.rect(L, y, W, thH).fillAndStroke(lightBg, black);
      let curX = L;
      cols.forEach((col, idx) => {
        if (idx > 0) doc.moveTo(curX, y).lineTo(curX, y + thH).stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
        doc.text(col.label, curX + 2, y + 4.5, { width: col.w - 4, align: col.align });
        curX += col.w;
      });
      y += thH;

      const drawTableHeader = () => {
        doc.rect(L, y, W, thH).fillAndStroke(lightBg, black);
        let hX = L;
        cols.forEach((col, idx) => {
          if (idx > 0) doc.moveTo(hX, y).lineTo(hX, y + thH).stroke();
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
          doc.text(col.label, hX + 2, y + 4.5, { width: col.w - 4, align: col.align });
          hX += col.w;
        });
        y += thH;
      };

      if (bills.length === 0) {
        const noDataH = 28;
        doc.rect(L, y, W, noDataH).stroke();
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(textMuted);
        doc.text('No outward supply invoices generated on this date.', L, y + 10, { width: W, align: 'center' });
        y += noDataH;
      } else {
        bills.forEach((b, idx) => {
          const rowH = 17;
          if (y + rowH > doc.page.height - 110) {
            doc.addPage();
            y = 28;
            drawTableHeader();
          }

          doc.rect(L, y, W, rowH).lineWidth(lineW).strokeColor(black).stroke();

          const qty = b.items && b.items.length > 0
            ? b.items.reduce((s, it) => s + (it.quantity || 0), 0)
            : (b.quantity || 0);
          const taxable = b.taxableValue || b.total || 0;
          const gst = (b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0);
          const gTot = b.grandTotal || b.total || 0;
          const invNo = b.formattedBillNo || b.billNo;

          let rX = L;
          // Sl
          doc.font('Helvetica').fontSize(7.5).fillColor(b.isVoided ? '#dc2626' : black);
          doc.text(String(idx + 1), rX + 2, y + 5, { width: cols[0].w - 4, align: 'center' });
          rX += cols[0].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Inv #
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(b.isVoided ? '#dc2626' : black);
          doc.text(`${b.isVoided ? '[VOID] ' : ''}#${invNo}`, rX + 2, y + 5, { width: cols[1].w - 4, align: 'center' });
          rX += cols[1].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Buyer Name
          doc.font('Helvetica').fontSize(7.5).fillColor(black);
          doc.text(b.companyName || 'Cash Customer', rX + 4, y + 5, { width: cols[2].w - 8, align: 'left' });
          rX += cols[2].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // GSTIN
          doc.font('Helvetica').fontSize(7).fillColor(textMuted);
          doc.text(b.companyGstin || 'URP', rX + 2, y + 5, { width: cols[3].w - 4, align: 'center' });
          rX += cols[3].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Qty
          doc.font('Helvetica').fontSize(7.5).fillColor(black);
          doc.text(Number(qty).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), rX + 2, y + 5, { width: cols[4].w - 4, align: 'right' });
          rX += cols[4].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Taxable
          doc.text(taxable.toFixed(2), rX + 2, y + 5, { width: cols[5].w - 4, align: 'right' });
          rX += cols[5].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // GST
          doc.text(gst.toFixed(2), rX + 2, y + 5, { width: cols[6].w - 4, align: 'right' });
          rX += cols[6].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Total
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
          doc.text(gTot.toFixed(2), rX + 2, y + 5, { width: cols[7].w - 4, align: 'right' });

          y += rowH;
        });

        // Totals Row
        const totRowH = 18;
        if (y + totRowH > doc.page.height - 110) {
          doc.addPage();
          y = 28;
        }

        const labelW = cols[0].w + cols[1].w + cols[2].w + cols[3].w;
        doc.rect(L, y, labelW, totRowH).fillAndStroke(lightBg, black);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text('TOTAL DAILY OUTWARD SUPPLY :', L + 4, y + 5, { width: labelW - 8, align: 'right' });

        let tX = L + labelW;
        // Total Qty
        doc.rect(tX, y, cols[4].w, totRowH).fillAndStroke(lightBg, black);
        doc.text(`${totalKg.toFixed(1)} KG`, tX + 2, y + 5, { width: cols[4].w - 4, align: 'right' });
        tX += cols[4].w;

        // Total Taxable
        doc.rect(tX, y, cols[5].w, totRowH).fillAndStroke(lightBg, black);
        doc.text(totalTaxable.toFixed(2), tX + 2, y + 5, { width: cols[5].w - 4, align: 'right' });
        tX += cols[5].w;

        // Total GST
        doc.rect(tX, y, cols[6].w, totRowH).fillAndStroke(lightBg, black);
        doc.text(totalGST.toFixed(2), tX + 2, y + 5, { width: cols[6].w - 4, align: 'right' });
        tX += cols[6].w;

        // Grand Total
        doc.rect(tX, y, cols[7].w, totRowH).fillAndStroke(lightBg, black);
        doc.text(totalRevenue.toFixed(2), tX + 2, y + 5, { width: cols[7].w - 4, align: 'right' });

        y += totRowH;
      }

      // ══════════════════════════════════════════════════════════════════════
      // 4. DAILY GST TAX BREAKDOWN SCHEDULE
      // ══════════════════════════════════════════════════════════════════════
      const taxSecH = 40;
      if (y + taxSecH > doc.page.height - 110) {
        doc.addPage();
        y = 28;
      }

      doc.rect(L, y, W, taxSecH).lineWidth(lineW).strokeColor(black).stroke();

      const taxColW = W / 5;
      [1, 2, 3, 4].forEach((i) => {
        doc.moveTo(L + taxColW * i, y).lineTo(L + taxColW * i, y + taxSecH).stroke();
      });
      doc.moveTo(L, y + 16).lineTo(R, y + 16).stroke();

      // Top Row Headers
      doc.rect(L, y, W, 16).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
      doc.text('TOTAL TAXABLE TURNOVER', L, y + 4.5, { width: taxColW, align: 'center' });
      doc.text('CENTRAL TAX (CGST)', L + taxColW, y + 4.5, { width: taxColW, align: 'center' });
      doc.text('STATE TAX (SGST)', L + taxColW * 2, y + 4.5, { width: taxColW, align: 'center' });
      doc.text('INTEGRATED TAX (IGST)', L + taxColW * 3, y + 4.5, { width: taxColW, align: 'center' });
      doc.text('TOTAL DAILY GST TAX', L + taxColW * 4, y + 4.5, { width: taxColW, align: 'center' });

      // Values Row
      const vY = y + 21;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text(`Rs. ${fmtINR(totalTaxable)}`, L, vY, { width: taxColW, align: 'center' });
      doc.text(`Rs. ${fmtINR(totalCGST)}`, L + taxColW, vY, { width: taxColW, align: 'center' });
      doc.text(`Rs. ${fmtINR(totalSGST)}`, L + taxColW * 2, vY, { width: taxColW, align: 'center' });
      doc.text(`Rs. ${fmtINR(totalIGST)}`, L + taxColW * 3, vY, { width: taxColW, align: 'center' });
      doc.text(`Rs. ${fmtINR(totalGST)}`, L + taxColW * 4, vY, { width: taxColW, align: 'center' });

      y += taxSecH;

      // ══════════════════════════════════════════════════════════════════════
      // 5. ATTESTATION, CERTIFICATION & SIGNATURES (STATUTORY FORMAT)
      // ══════════════════════════════════════════════════════════════════════
      const signBoxH = 68;
      if (y + signBoxH > doc.page.height - 50) {
        doc.addPage();
        y = 28;
      }

      const signLeftW = Math.floor(W * 0.58);
      const signRightW = W - signLeftW;

      doc.rect(L, y, signLeftW, signBoxH).lineWidth(lineW).strokeColor(black).stroke();
      doc.rect(L + signLeftW, y, signRightW, signBoxH).lineWidth(lineW).strokeColor(black).stroke();

      // Left Box: Statutory Certificate
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('STATUTORY VERIFICATION & CERTIFICATE:', L + 6, y + 5);

      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted);
      doc.text(
        'Certified that the entries made in this register represent a complete, true and correct record of actual outward supplies, quantities dispatched and tax liabilities incurred on this date in accordance with the provisions of the Central Goods and Services Tax Act, 2017.',
        L + 6,
        y + 15,
        { width: signLeftW - 12, lineGap: 1.5 }
      );

      doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
      doc.text('Books of accounts verified against invoice duplicates.', L + 6, y + 53);

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
          `Page ${i + 1} of ${pageCount}   |   Statutory Day Book & Outward Supply Register   |   Vijaya Durga Agencies`,
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

module.exports = { generateDailyReportPDF };

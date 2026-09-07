const PDFDocument = require('pdfkit');

function fmtINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate Official Government GSTR-1 Return / Outward Supplies Summary PDF
 * (Prescribed format under Rule 59(1) of the CGST Rules, 2017)
 */
async function generateGSTR1PDF({ bills = [], dateRange = {}, settings = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `FORM GSTR-1 Statement - ${dateRange.label || 'Summary'}`,
          Author: settings.businessName || 'VIJAYA DURGA AGENCIES',
          Subject: 'Official Government GSTR-1 Statement of Outward Supplies',
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

      const validBills = bills.filter((b) => !b.isVoided);
      const voidedBills = bills.filter((b) => b.isVoided);
      const b2bBills = validBills.filter((b) => b.companyGstin && b.companyGstin.trim().length >= 10);
      const b2cBills = validBills.filter((b) => !b.companyGstin || b.companyGstin.trim().length < 10);

      // ══════════════════════════════════════════════════════════════════════
      // 1. OFFICIAL FORM GSTR-1 BANNER
      // ══════════════════════════════════════════════════════════════════════
      const bannerH = 34;
      doc.rect(L, y, W, bannerH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);

      doc.font('Helvetica-Bold').fontSize(12).fillColor(black);
      doc.text('FORM GSTR-1', L, y + 5, { width: W, align: 'center', characterSpacing: 1 });

      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(textMuted);
      doc.text('[See Rule 59(1) of the Central Goods and Services Tax Rules, 2017]', L, y + 17, { width: W, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('DETAILS OF OUTWARD SUPPLIES OF GOODS OR SERVICES', L, y + 24, { width: W, align: 'center', characterSpacing: 0.5 });

      y += bannerH;

      // ══════════════════════════════════════════════════════════════════════
      // 2. TAXPAYER STATUTORY PARTICULARS (TABLE 1, 2, 3)
      // ══════════════════════════════════════════════════════════════════════
      const tpBoxH = 46;
      doc.rect(L, y, W, tpBoxH).lineWidth(lineW).strokeColor(black).stroke();

      const halfW = W / 2;
      doc.moveTo(L + halfW, y).lineTo(L + halfW, y + tpBoxH).stroke();

      const gstin = settings.gstin || '37KATPS1500Q1ZR';
      const pan = gstin.length >= 12 ? gstin.substring(2, 12) : 'KATPS1500Q';

      // Left Box
      doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted);
      doc.text('1. GSTIN of Taxpayer :', L + 6, y + 5);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text(gstin, L + 110, y + 4.5);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('2(a). Legal Name :', L + 6, y + 18);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(settings.legalName || 'SATTINENI VENKATA DHANA LAXMI', L + 110, y + 18);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('2(b). Trade Name :', L + 6, y + 31);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text(settings.businessName || 'VIJAYA DURGA AGENCIES', L + 110, y + 30.5);

      // Right Box
      doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted);
      doc.text('3(a). Financial Year :', L + halfW + 6, y + 5);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text('2024 - 2025', L + halfW + 110, y + 5);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('3(b). Tax Period / Range :', L + halfW + 6, y + 18);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(periodStr, L + halfW + 110, y + 18);

      doc.font('Helvetica').fontSize(7).fillColor(textMuted);
      doc.text('3(c). State of Operation :', L + halfW + 6, y + 31);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('Andhra Pradesh (Code: 37)', L + halfW + 110, y + 31);

      y += tpBoxH;

      // ══════════════════════════════════════════════════════════════════════
      // 3. TABLE 4: B2B INVOICES (TAXABLE SUPPLIES TO REGISTERED PERSONS)
      // ══════════════════════════════════════════════════════════════════════
      const t4TitleH = 15;
      doc.rect(L, y, W, t4TitleH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`TABLE 4: TAXABLE OUTWARD SUPPLIES TO REGISTERED PERSONS (B2B) - ${b2bBills.length} RECORDS`, L + 6, y + 4);
      y += t4TitleH;

      const t4Cols = [
        { l: 'Recipient GSTIN', w: 86, a: 'center' },
        { l: 'Receiver / Firm Name', w: 122, a: 'left' },
        { l: 'Inv #', w: 68, a: 'center' },
        { l: 'Date', w: 52, a: 'center' },
        { l: 'Taxable (Rs.)', w: 68, a: 'right' },
        { l: 'GST Tax (Rs.)', w: 67, a: 'right' },
        { l: 'Invoice Val (Rs.)', w: 76.28, a: 'right' },
      ];

      const drawT4Header = () => {
        const thH = 15;
        doc.rect(L, y, W, thH).fillAndStroke(lightBg, black);
        let curX = L;
        t4Cols.forEach((c, idx) => {
          if (idx > 0) doc.moveTo(curX, y).lineTo(curX, y + thH).stroke();
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
          doc.text(c.l, curX + 2, y + 4.5, { width: c.w - 4, align: c.a });
          curX += c.w;
        });
        y += thH;
      };

      drawT4Header();

      let b2bTotalTaxable = 0;
      let b2bTotalGST = 0;
      let b2bTotalInvoice = 0;

      if (b2bBills.length === 0) {
        const noH = 20;
        doc.rect(L, y, W, noH).stroke();
        doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(textMuted);
        doc.text('Nil taxable outward supplies to registered persons (B2B) during this period.', L, y + 6, { width: W, align: 'center' });
        y += noH;
      } else {
        b2bBills.forEach((b) => {
          const rowH = 15;
          if (y + rowH > doc.page.height - 100) {
            doc.addPage();
            y = 28;
            drawT4Header();
          }

          doc.rect(L, y, W, rowH).lineWidth(lineW).strokeColor(black).stroke();

          const invNo = b.formattedBillNo || b.billNo;
          const dStr = b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
          const taxable = b.taxableValue || b.total || 0;
          const gst = (b.cgstAmount || 0) + (b.sgstAmount || 0) + (b.igstAmount || 0);
          const gTot = b.grandTotal || b.total || 0;

          b2bTotalTaxable += taxable;
          b2bTotalGST += gst;
          b2bTotalInvoice += gTot;

          let rX = L;
          // GSTIN
          doc.font('Helvetica').fontSize(7).fillColor(black);
          doc.text(b.companyGstin, rX + 2, y + 4, { width: t4Cols[0].w - 4, align: 'center' });
          rX += t4Cols[0].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Receiver Name
          doc.text(b.companyName.substring(0, 24), rX + 4, y + 4, { width: t4Cols[1].w - 8, align: 'left' });
          rX += t4Cols[1].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Inv No
          doc.font('Helvetica-Bold');
          doc.text(`#${invNo}`, rX + 2, y + 4, { width: t4Cols[2].w - 4, align: 'center' });
          rX += t4Cols[2].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Date
          doc.font('Helvetica');
          doc.text(dStr, rX + 2, y + 4, { width: t4Cols[3].w - 4, align: 'center' });
          rX += t4Cols[3].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Taxable
          doc.text(taxable.toFixed(2), rX + 2, y + 4, { width: t4Cols[4].w - 4, align: 'right' });
          rX += t4Cols[4].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // GST
          doc.text(gst.toFixed(2), rX + 2, y + 4, { width: t4Cols[5].w - 4, align: 'right' });
          rX += t4Cols[5].w;
          doc.moveTo(rX, y).lineTo(rX, y + rowH).stroke();

          // Invoice Total
          doc.font('Helvetica-Bold');
          doc.text(gTot.toFixed(2), rX + 2, y + 4, { width: t4Cols[6].w - 4, align: 'right' });

          y += rowH;
        });

        // B2B Total Row
        const totH = 16;
        const sumLabelW = t4Cols[0].w + t4Cols[1].w + t4Cols[2].w + t4Cols[3].w;
        doc.rect(L, y, sumLabelW, totH).fillAndStroke(lightBg, black);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text('TOTAL B2B OUTWARD SUPPLIES :', L + 4, y + 4.5, { width: sumLabelW - 8, align: 'right' });

        let tX = L + sumLabelW;
        doc.rect(tX, y, t4Cols[4].w, totH).fillAndStroke(lightBg, black);
        doc.text(fmtINR(b2bTotalTaxable), tX + 2, y + 4.5, { width: t4Cols[4].w - 4, align: 'right' });
        tX += t4Cols[4].w;

        doc.rect(tX, y, t4Cols[5].w, totH).fillAndStroke(lightBg, black);
        doc.text(fmtINR(b2bTotalGST), tX + 2, y + 4.5, { width: t4Cols[5].w - 4, align: 'right' });
        tX += t4Cols[5].w;

        doc.rect(tX, y, t4Cols[6].w, totH).fillAndStroke(lightBg, black);
        doc.text(fmtINR(b2bTotalInvoice), tX + 2, y + 4.5, { width: t4Cols[6].w - 4, align: 'right' });

        y += totH;
      }

      // ══════════════════════════════════════════════════════════════════════
      // 4. TABLE 7: B2C SMALL (TAXABLE SUPPLIES TO UNREGISTERED PERSONS)
      // ══════════════════════════════════════════════════════════════════════
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 28;
      }

      const t7TitleH = 15;
      doc.rect(L, y, W, t7TitleH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`TABLE 7: TAXABLE OUTWARD SUPPLIES TO CONSUMERS / UNREGISTERED (B2C SMALL)`, L + 6, y + 4);
      y += t7TitleH;

      const t7Cols = [
        { l: 'Type / Category', w: 100, a: 'center' },
        { l: 'Place Of Supply (State)', w: 140, a: 'left' },
        { l: 'Invoices Count', w: 65, a: 'center' },
        { l: 'Applicable Rate', w: 68, a: 'center' },
        { l: 'Taxable Value (Rs.)', w: 80, a: 'right' },
        { l: 'Total Invoice Val (Rs.)', w: 86.28, a: 'right' },
      ];

      const thH7 = 15;
      doc.rect(L, y, W, thH7).fillAndStroke(lightBg, black);
      let cur7X = L;
      t7Cols.forEach((c, idx) => {
        if (idx > 0) doc.moveTo(cur7X, y).lineTo(cur7X, y + thH7).stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
        doc.text(c.l, cur7X + 2, y + 4.5, { width: c.w - 4, align: c.a });
        cur7X += c.w;
      });
      y += thH7;

      const b2cTaxable = b2cBills.reduce((s, b) => s + (b.taxableValue || b.total || 0), 0);
      const b2cTotal = b2cBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

      const rH7 = 16;
      doc.rect(L, y, W, rH7).lineWidth(lineW).strokeColor(black).stroke();
      let r7X = L;

      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text('Other than E-Comm (OE)', r7X + 2, y + 4.5, { width: t7Cols[0].w - 4, align: 'center' });
      r7X += t7Cols[0].w;
      doc.moveTo(r7X, y).lineTo(r7X, y + rH7).stroke();

      doc.text('37 - Andhra Pradesh (Intra-State)', r7X + 4, y + 4.5, { width: t7Cols[1].w - 8, align: 'left' });
      r7X += t7Cols[1].w;
      doc.moveTo(r7X, y).lineTo(r7X, y + rH7).stroke();

      doc.text(String(b2cBills.length), r7X + 2, y + 4.5, { width: t7Cols[2].w - 4, align: 'center' });
      r7X += t7Cols[2].w;
      doc.moveTo(r7X, y).lineTo(r7X, y + rH7).stroke();

      doc.text('0% / Nil Exempt', r7X + 2, y + 4.5, { width: t7Cols[3].w - 4, align: 'center' });
      r7X += t7Cols[3].w;
      doc.moveTo(r7X, y).lineTo(r7X, y + rH7).stroke();

      doc.text(fmtINR(b2cTaxable), r7X + 2, y + 4.5, { width: t7Cols[4].w - 4, align: 'right' });
      r7X += t7Cols[4].w;
      doc.moveTo(r7X, y).lineTo(r7X, y + rH7).stroke();

      doc.font('Helvetica-Bold');
      doc.text(fmtINR(b2cTotal), r7X + 2, y + 4.5, { width: t7Cols[5].w - 4, align: 'right' });

      y += rH7;

      // ══════════════════════════════════════════════════════════════════════
      // 5. TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES
      // ══════════════════════════════════════════════════════════════════════
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 28;
      }

      const t12TitleH = 15;
      doc.rect(L, y, W, t12TitleH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES`, L + 6, y + 4);
      y += t12TitleH;

      const t12Cols = [
        { l: 'HSN Code', w: 60, a: 'center' },
        { l: 'Description of Goods', w: 160, a: 'left' },
        { l: 'UQC', w: 45, a: 'center' },
        { l: 'Total Qty', w: 55, a: 'right' },
        { l: 'Total Value (Rs.)', w: 75, a: 'right' },
        { l: 'Taxable (Rs.)', w: 74, a: 'right' },
        { l: 'Central Tax (Rs.)', w: 70.28, a: 'right' },
      ];

      const thH12 = 15;
      doc.rect(L, y, W, thH12).fillAndStroke(lightBg, black);
      let cur12X = L;
      t12Cols.forEach((c, idx) => {
        if (idx > 0) doc.moveTo(cur12X, y).lineTo(cur12X, y + thH12).stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
        doc.text(c.l, cur12X + 2, y + 4.5, { width: c.w - 4, align: c.a });
        cur12X += c.w;
      });
      y += thH12;

      // Aggregate HSN items
      const hsnMap = new Map();
      validBills.forEach((b) => {
        if (b.items && b.items.length > 0) {
          b.items.forEach((it) => {
            const code = it.hsn || '0306';
            const prev = hsnMap.get(code) || {
              hsn: code,
              desc: it.particulars || 'Fresh Seafood / Prawns Supply',
              uqc: 'KGS',
              qty: 0,
              totalVal: 0,
              taxableVal: 0,
              cgst: 0,
            };
            prev.qty += it.quantity || 0;
            prev.totalVal += it.amount || 0;
            prev.taxableVal += it.amount || 0;
            prev.cgst += (b.cgstAmount ? (b.cgstAmount / b.items.length) : 0);
            hsnMap.set(code, prev);
          });
        } else {
          const code = b.hsn || '0306';
          const prev = hsnMap.get(code) || {
            hsn: code,
            desc: b.particulars || 'Fresh Seafood / Prawns Supply',
            uqc: 'KGS',
            qty: 0,
            totalVal: 0,
            taxableVal: 0,
            cgst: 0,
          };
          prev.qty += b.quantity || 0;
          prev.totalVal += b.grandTotal || b.total || 0;
          prev.taxableVal += b.taxableValue || b.total || 0;
          prev.cgst += b.cgstAmount || 0;
          hsnMap.set(code, prev);
        }
      });

      hsnMap.forEach((val) => {
        const rowH = 15;
        doc.rect(L, y, W, rowH).lineWidth(lineW).strokeColor(black).stroke();

        let r12X = L;
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text(val.hsn, r12X + 2, y + 4, { width: t12Cols[0].w - 4, align: 'center' });
        r12X += t12Cols[0].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.font('Helvetica').fontSize(7.5);
        doc.text(val.desc.substring(0, 26), r12X + 4, y + 4, { width: t12Cols[1].w - 8, align: 'left' });
        r12X += t12Cols[1].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.text(val.uqc, r12X + 2, y + 4, { width: t12Cols[2].w - 4, align: 'center' });
        r12X += t12Cols[2].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.text(val.qty.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), r12X + 2, y + 4, { width: t12Cols[3].w - 4, align: 'right' });
        r12X += t12Cols[3].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.text(val.totalVal.toFixed(2), r12X + 2, y + 4, { width: t12Cols[4].w - 4, align: 'right' });
        r12X += t12Cols[4].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.text(val.taxableVal.toFixed(2), r12X + 2, y + 4, { width: t12Cols[5].w - 4, align: 'right' });
        r12X += t12Cols[5].w;
        doc.moveTo(r12X, y).lineTo(r12X, y + rowH).stroke();

        doc.font('Helvetica-Bold');
        doc.text(val.cgst.toFixed(2), r12X + 2, y + 4, { width: t12Cols[6].w - 4, align: 'right' });

        y += rowH;
      });

      // ══════════════════════════════════════════════════════════════════════
      // 6. TABLE 13: DOCUMENTS ISSUED DURING THE TAX PERIOD
      // ══════════════════════════════════════════════════════════════════════
      if (y > doc.page.height - 140) {
        doc.addPage();
        y = 28;
      }

      const t13TitleH = 15;
      doc.rect(L, y, W, t13TitleH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`TABLE 13: DOCUMENTS ISSUED DURING THE TAX PERIOD`, L + 6, y + 4);
      y += t13TitleH;

      const t13Cols = [
        { l: 'Nature of Document', w: 160, a: 'left' },
        { l: 'Sr. No. From', w: 85, a: 'center' },
        { l: 'Sr. No. To', w: 85, a: 'center' },
        { l: 'Total Number', w: 70, a: 'center' },
        { l: 'Cancelled', w: 65, a: 'center' },
        { l: 'Net Issued', w: 74.28, a: 'center' },
      ];

      const thH13 = 15;
      doc.rect(L, y, W, thH13).fillAndStroke(lightBg, black);
      let cur13X = L;
      t13Cols.forEach((c, idx) => {
        if (idx > 0) doc.moveTo(cur13X, y).lineTo(cur13X, y + thH13).stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(black);
        doc.text(c.l, cur13X + 2, y + 4.5, { width: c.w - 4, align: c.a });
        cur13X += c.w;
      });
      y += thH13;

      const firstBillNo = bills.length > 0 ? (bills[0].formattedBillNo || bills[0].billNo) : '—';
      const lastBillNo = bills.length > 0 ? (bills[bills.length - 1].formattedBillNo || bills[bills.length - 1].billNo) : '—';

      const rH13 = 16;
      doc.rect(L, y, W, rH13).lineWidth(lineW).strokeColor(black).stroke();
      let r13X = L;

      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text('Invoices for outward supply', r13X + 4, y + 4.5, { width: t13Cols[0].w - 8, align: 'left' });
      r13X += t13Cols[0].w;
      doc.moveTo(r13X, y).lineTo(r13X, y + rH13).stroke();

      doc.text(String(firstBillNo), r13X + 2, y + 4.5, { width: t13Cols[1].w - 4, align: 'center' });
      r13X += t13Cols[1].w;
      doc.moveTo(r13X, y).lineTo(r13X, y + rH13).stroke();

      doc.text(String(lastBillNo), r13X + 2, y + 4.5, { width: t13Cols[2].w - 4, align: 'center' });
      r13X += t13Cols[2].w;
      doc.moveTo(r13X, y).lineTo(r13X, y + rH13).stroke();

      doc.text(String(bills.length), r13X + 2, y + 4.5, { width: t13Cols[3].w - 4, align: 'center' });
      r13X += t13Cols[3].w;
      doc.moveTo(r13X, y).lineTo(r13X, y + rH13).stroke();

      doc.text(String(voidedBills.length), r13X + 2, y + 4.5, { width: t13Cols[4].w - 4, align: 'center' });
      r13X += t13Cols[4].w;
      doc.moveTo(r13X, y).lineTo(r13X, y + rH13).stroke();

      doc.font('Helvetica-Bold');
      doc.text(String(validBills.length), r13X + 2, y + 4.5, { width: t13Cols[5].w - 4, align: 'center' });

      y += rH13 + 12;

      // ══════════════════════════════════════════════════════════════════════
      // 7. STATUTORY VERIFICATION & DECLARATION
      // ══════════════════════════════════════════════════════════════════════
      const decBoxH = 60;
      if (y + decBoxH > doc.page.height - 40) {
        doc.addPage();
        y = 28;
      }

      doc.rect(L, y, W, decBoxH).lineWidth(lineW).strokeColor(black).stroke();

      const decLeftW = Math.floor(W * 0.60);
      const decRightW = W - decLeftW;
      doc.moveTo(L + decLeftW, y).lineTo(L + decLeftW, y + decBoxH).stroke();

      // Left Box: Declaration
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('STATUTORY VERIFICATION (RULE 59):', L + 6, y + 5);

      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted);
      doc.text(
        'I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom.',
        L + 6,
        y + 16,
        { width: decLeftW - 12, lineGap: 1.5 }
      );

      doc.font('Helvetica').fontSize(6.5).fillColor(black);
      doc.text(`Place: Narasapur, Andhra Pradesh   |   Date: ${new Date().toLocaleDateString('en-IN')}`, L + 6, y + 46);

      // Right Box: Signature
      const sX = L + decLeftW;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text(`For ${settings.businessName || 'VIJAYA DURGA AGENCIES'}`, sX + 6, y + 6, {
        width: decRightW - 12,
        align: 'center',
      });

      doc.font('Helvetica-Oblique').fontSize(6).fillColor('#94a3b8');
      doc.text('[ Signature of Authorised Signatory ]', sX + 6, y + decBoxH - 24, {
        width: decRightW - 12,
        align: 'center',
      });

      doc.moveTo(sX + 24, y + decBoxH - 14).lineTo(sX + decRightW - 24, y + decBoxH - 14).strokeColor(black).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('AUTHORISED SIGNATORY', sX + 6, y + decBoxH - 11, {
        width: decRightW - 12,
        align: 'center',
      });

      // Page numbering on all buffered pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
        doc.text(
          `Page ${i + 1} of ${pageCount}   |   FORM GSTR-1 Statement of Outward Supplies   |   Vijaya Durga Agencies`,
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

module.exports = { generateGSTR1PDF };

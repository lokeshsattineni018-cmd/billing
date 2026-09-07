const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');

/**
 * Standard Indian GST State Codes mapping
 */
const GST_STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

/**
 * Helper to derive State Name and Code from a GSTIN
 */
function getStateFromGstin(gstin, fallbackState = 'Andhra Pradesh', fallbackCode = '37') {
  if (!gstin || typeof gstin !== 'string' || gstin.trim().length < 2) {
    return { stateName: fallbackState, stateCode: fallbackCode };
  }
  const clean = gstin.trim();
  const code = clean.substring(0, 2);
  const name = GST_STATE_CODES[code] || fallbackState;
  return { stateName: name, stateCode: code };
}

/**
 * Convert number to words in Indian Currency Format with Paise support
 */
function numberToWords(amount) {
  if (!amount || isNaN(amount) || amount === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelow1000(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  }

  const num = Math.abs(Number(amount));
  const intPart = Math.floor(num);
  const paisePart = Math.round((num - intPart) * 100);

  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const hundred = intPart % 1000;

  const parts = [];
  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (hundred > 0) parts.push(convertBelow1000(hundred));

  let words = parts.join(' ').trim();
  if (!words) words = 'Zero';

  let result = `${words} Rupees`;
  if (paisePart > 0) {
    result += ` and ${convertBelow1000(paisePart)} Paise`;
  }
  return result + ' Only';
}

/**
 * Generate Official Government-Standard GST Tax Invoice PDF (Rule 46 Compliant)
 */
async function generateBillPDFBuffer(bill) {
  return new Promise(async (resolve, reject) => {
    try {
      let settings = await Settings.findOne().lean();
      if (!settings) {
        throw new Error('Business settings not found in database. Please configure settings first.');
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `Tax Invoice - #${bill.billNo}`,
          Author: settings.businessName || 'VIJAYA DURGA AGENCIES',
          Subject: 'Official GST Tax Invoice (Rule 46)',
          Keywords: 'GST, Tax Invoice, Government Document, Official',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Geometry Constants
      const L = 28;                           // Left margin
      const R = doc.page.width - 28;          // Right edge (567.28 pt)
      const W = R - L;                        // Total content width (539.28 pt)

      // Formal Institutional Palette
      const black = '#000000';
      const textMain = '#111827';
      const textMuted = '#374151';
      const lightBg = '#f1f5f9';
      const headerBg = '#e2e8f0';
      const lineW = 0.65;

      let y = 28;

      // ══════════════════════════════════════════════════════════════════════
      // 1. STATUTORY TOP HEADER: TAX INVOICE (Rule 46) & COPY DESIGNATION
      // ══════════════════════════════════════════════════════════════════════
      const bannerH = 26;
      doc.rect(L, y, W, bannerH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);

      // Title (Centered)
      doc.font('Helvetica-Bold').fontSize(12).fillColor(black);
      doc.text('TAX INVOICE', L, y + 4, { width: W, align: 'center', characterSpacing: 1.2 });

      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(textMuted);
      doc.text('(Issued under Section 31 of the CGST Act, 2017 read with Rule 46 of the CGST Rules, 2017)', L, y + 17, { width: W, align: 'center' });

      // Copy marker (Top Right)
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('[X] ORIGINAL FOR RECIPIENT', R - 140, y + 6, { width: 132, align: 'right' });
      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted);
      doc.text('[  ] DUPLICATE FOR TRANSPORTER', R - 140, y + 15, { width: 132, align: 'right' });

      y += bannerH;

      // ══════════════════════════════════════════════════════════════════════
      // 2. SUPPLIER DETAILS (LEFT 55%) | INVOICE & DISPATCH DETAILS (RIGHT 45%)
      // ══════════════════════════════════════════════════════════════════════
      const row2H = 92;
      const leftW = Math.floor(W * 0.55); // 296 pt
      const rightW = W - leftW;            // 243.28 pt

      doc.rect(L, y, leftW, row2H).lineWidth(lineW).strokeColor(black).stroke();
      doc.rect(L + leftW, y, rightW, row2H).lineWidth(lineW).strokeColor(black).stroke();

      // --- Left Box: Supplier Details ---
      const supplierHeaderH = 14;
      doc.rect(L, y, leftW, supplierHeaderH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('DETAILS OF SUPPLIER / CONSIGNOR', L + 6, y + 3.5);

      const sY = y + supplierHeaderH + 4;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(black);
      doc.text(settings.businessName || 'VIJAYA DURGA AGENCIES', L + 6, sY);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text(`Proprietor: ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}`, L + 6, sY + 13);

      doc.font('Helvetica').fontSize(7).fillColor(black);
      doc.text(
        settings.address || 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
        L + 6,
        sY + 23,
        { width: leftW - 12, lineGap: 1 }
      );

      const supplierGstin = settings.gstin || '37KATPS1500Q1ZR';
      const supplierPan = supplierGstin.length >= 12 ? supplierGstin.substring(2, 12) : 'KATPS1500Q';
      const supplierStateInfo = getStateFromGstin(supplierGstin, 'Andhra Pradesh', '37');

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`GSTIN : `, L + 6, sY + 47, { continued: true });
      doc.font('Helvetica').text(supplierGstin, { continued: true });
      doc.font('Helvetica-Bold').text(`   PAN : `, { continued: true });
      doc.font('Helvetica').text(supplierPan);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text(`State : `, L + 6, sY + 58, { continued: true });
      doc.font('Helvetica').text(`${supplierStateInfo.stateName} (Code: ${supplierStateInfo.stateCode})`, { continued: true });
      doc.font('Helvetica-Bold').text(`   Mob : `, { continued: true });
      doc.font('Helvetica').text(settings.phone || '9441429745');

      // --- Right Box: Invoice & Supply Meta ---
      const invHeaderH = 14;
      doc.rect(L + leftW, y, rightW, invHeaderH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('INVOICE & SUPPLY DETAILS', L + leftW + 6, y + 3.5);

      const billDate = new Date(bill.date);
      const dd = String(billDate.getDate()).padStart(2, '0');
      const mm = String(billDate.getMonth() + 1).padStart(2, '0');
      const yyyy = billDate.getFullYear();
      const formattedDate = `${dd}-${mm}-${yyyy}`;

      const invNoDisplay = bill.formattedBillNo || (settings.invoicePrefix ? `${settings.invoicePrefix}${String(bill.billNo).padStart(4, '0')}` : `#${bill.billNo}`);
      const buyerGstin = bill.companyGstin || '';
      const buyerPan = buyerGstin.length >= 12 ? buyerGstin.substring(2, 12) : 'N/A';
      const buyerStateInfo = getStateFromGstin(buyerGstin, 'Andhra Pradesh', '37');

      const metaRows = [
        { label: 'Invoice No.', value: invNoDisplay, bold: true },
        { label: 'Invoice Date', value: formattedDate, bold: false },
        { label: 'Place of Supply', value: `${buyerStateInfo.stateName} (${buyerStateInfo.stateCode})`, bold: false },
        { label: 'Reverse Charge', value: 'No', bold: false },
        { label: 'Transport Mode', value: 'By Road / Goods Vehicle', bold: false },
        { label: 'Payment Terms', value: 'On Demand / Credit', bold: false },
      ];

      let metaY = y + invHeaderH + 4;
      metaRows.forEach((r) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
        doc.text(r.label, L + leftW + 6, metaY, { width: 85 });
        doc.font('Helvetica').text(':', L + leftW + 92, metaY);
        doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(black);
        doc.text(r.value, L + leftW + 100, metaY, { width: rightW - 106 });
        metaY += 11.5;
      });

      y += row2H;

      // ══════════════════════════════════════════════════════════════════════
      // 3. DETAILS OF RECIPIENT (BILLED TO & SHIPPED TO)
      // ══════════════════════════════════════════════════════════════════════
      const buyerH = 54;
      doc.rect(L, y, W, buyerH).lineWidth(lineW).strokeColor(black).stroke();

      const buyerHeaderH = 14;
      doc.rect(L, y, W, buyerHeaderH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('DETAILS OF RECIPIENT / BILLED TO & SHIPPED TO', L + 6, y + 3.5);

      const bY = y + buyerHeaderH + 4;
      // Buyer Name (Dedicated bold block)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text('Billed To / M/s :', L + 6, bY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(black);
      doc.text(bill.companyName || 'Cash Customer', L + 80, bY, { width: leftW - 86 });

      // Buyer Address / Place
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
      doc.text('Address :', L + 6, bY + 16);
      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(`${buyerStateInfo.stateName}, India (As per records)`, L + 80, bY + 16, { width: leftW - 86 });

      // Buyer State
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
      doc.text('State & Code :', L + 6, bY + 27);
      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(`${buyerStateInfo.stateName} (Code: ${buyerStateInfo.stateCode})`, L + 80, bY + 27, { width: leftW - 86 });

      // Right Side: Buyer GSTIN, PAN & Contact
      const bRightX = L + leftW + 6;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textMuted);
      doc.text('Buyer GSTIN :', bRightX, bY);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text(buyerGstin || 'URP (Unregistered Person)', bRightX + 75, bY, { width: rightW - 82 });

      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
      doc.text('Buyer PAN :', bRightX, bY + 13);
      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(buyerPan, bRightX + 75, bY + 13, { width: rightW - 82 });

      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
      doc.text('Contact No. :', bRightX, bY + 24);
      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(bill.customerPhone || 'N/A', bRightX + 75, bY + 24, { width: rightW - 82 });

      y += buyerH;

      // ══════════════════════════════════════════════════════════════════════
      // 4. SCHEDULE OF GOODS / SERVICES (OFFICIAL GST INVOICE TABLE)
      // ══════════════════════════════════════════════════════════════════════
      const cols = {
        sno:     28,
        desc:   190,
        hsn:     52,
        qty:     55,
        rate:    64,
        taxable: 75,
        amt:     W - (28 + 190 + 52 + 55 + 64 + 75), // 75.28 pt
      };

      const colX = {
        sno:     L,
        desc:    L + cols.sno,
        hsn:     L + cols.sno + cols.desc,
        qty:     L + cols.sno + cols.desc + cols.hsn,
        rate:    L + cols.sno + cols.desc + cols.hsn + cols.qty,
        taxable: L + cols.sno + cols.desc + cols.hsn + cols.qty + cols.rate,
        amt:     L + cols.sno + cols.desc + cols.hsn + cols.qty + cols.rate + cols.taxable,
      };

      const thH = 20;
      doc.rect(L, y, W, thH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);

      // Header vertical grid lines
      Object.keys(cols).forEach((key) => {
        doc.rect(colX[key], y, cols[key], thH).stroke();
      });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('Sl.', colX.sno, y + 6, { width: cols.sno, align: 'center' });
      doc.text('Description of Goods / Services', colX.desc + 6, y + 6, { width: cols.desc - 12 });
      doc.text('HSN/SAC', colX.hsn, y + 6, { width: cols.hsn, align: 'center' });
      doc.text('Qty (KG)', colX.qty, y + 6, { width: cols.qty, align: 'center' });
      doc.text('Unit Rate (Rs.)', colX.rate, y + 6, { width: cols.rate - 6, align: 'right' });
      doc.text('Taxable Amt (Rs.)', colX.taxable, y + 6, { width: cols.taxable - 6, align: 'right' });
      doc.text('Total (Rs.)', colX.amt, y + 6, { width: cols.amt - 6, align: 'right' });

      y += thH;

      // Render Item rows
      const itemsList = bill.items && bill.items.length > 0 ? bill.items : [{
        sno: 1,
        particulars: bill.particulars || 'Fresh Seafood / Prawns Supply',
        hsn: bill.hsn || '0306',
        quantity: bill.quantity,
        rate: bill.rate,
        taxRate: '',
        amount: bill.total,
      }];

      let totalQty = 0;
      let totalTaxableValue = 0;
      let totalGrossAmount = 0;

      const itemRowH = 20;
      itemsList.forEach((item, index) => {
        Object.keys(cols).forEach((key) => {
          doc.rect(colX[key], y, cols[key], itemRowH).lineWidth(lineW).strokeColor(black).stroke();
        });

        const qty = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const amt = Number(item.amount) || (qty * rate);
        const itemTaxable = bill.taxableValue > 0 ? (bill.taxableValue / itemsList.length) : amt;

        totalQty += qty;
        totalTaxableValue += itemTaxable;
        totalGrossAmount += amt;

        doc.font('Helvetica').fontSize(8).fillColor(black);
        doc.text(String(index + 1), colX.sno, y + 6, { width: cols.sno, align: 'center' });
        doc.font('Helvetica-Bold').text(item.particulars || 'Fresh Seafood / Prawns Supply', colX.desc + 6, y + 6, { width: cols.desc - 12 });
        doc.font('Helvetica').text(item.hsn || '0306', colX.hsn, y + 6, { width: cols.hsn, align: 'center' });
        doc.text(`${qty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX.qty, y + 6, { width: cols.qty, align: 'center' });
        doc.text(`${rate.toFixed(2)}`, colX.rate, y + 6, { width: cols.rate - 6, align: 'right' });
        doc.text(`${itemTaxable.toFixed(2)}`, colX.taxable, y + 6, { width: cols.taxable - 6, align: 'right' });
        doc.font('Helvetica-Bold');
        doc.text(`${amt.toFixed(2)}`, colX.amt, y + 6, { width: cols.amt - 6, align: 'right' });

        y += itemRowH;
      });

      // Maintain formal legal spacing if few items
      const minTableRows = 3;
      const blankRowsNeeded = Math.max(0, minTableRows - itemsList.length);
      const blankH = 16;
      for (let i = 0; i < blankRowsNeeded; i++) {
        Object.keys(cols).forEach((key) => {
          doc.rect(colX[key], y, cols[key], blankH).lineWidth(lineW).strokeColor(black).stroke();
        });
        y += blankH;
      }

      // Schedule Total Row
      const subtotalH = 20;
      const subtotalLabelW = cols.sno + cols.desc + cols.hsn;
      doc.rect(L, y, subtotalLabelW, subtotalH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);
      doc.rect(colX.qty, y, cols.qty, subtotalH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);
      doc.rect(colX.rate, y, cols.rate, subtotalH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);
      doc.rect(colX.taxable, y, cols.taxable, subtotalH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);
      doc.rect(colX.amt, y, cols.amt, subtotalH).lineWidth(lineW).strokeColor(black).fillAndStroke(lightBg, black);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(black);
      doc.text('TOTAL :', L + 6, y + 6, { width: subtotalLabelW - 12, align: 'right' });
      doc.text(`${totalQty.toFixed(2)} KG`, colX.qty, y + 6, { width: cols.qty, align: 'center' });
      doc.text('—', colX.rate, y + 6, { width: cols.rate - 6, align: 'center' });
      doc.text(`${totalTaxableValue.toFixed(2)}`, colX.taxable, y + 6, { width: cols.taxable - 6, align: 'right' });
      doc.text(`${totalGrossAmount.toFixed(2)}`, colX.amt, y + 6, { width: cols.amt - 6, align: 'right' });

      y += subtotalH;

      // ══════════════════════════════════════════════════════════════════════
      // 5. OFFICIAL HSN/SAC TAX COMPUTATION SCHEDULE
      // ══════════════════════════════════════════════════════════════════════
      const taxTableH1 = 14;
      const taxTableH2 = 13;
      const taxDataRowH = 18;

      const isInterState = supplierStateInfo.stateCode !== buyerStateInfo.stateCode;
      const hsnCode = bill.hsn || (bill.items?.[0]?.hsn) || '0306';
      const actualTaxable = bill.taxableValue > 0 ? bill.taxableValue : bill.total;

      const taxCols = {
        hsn:     70,
        taxable: 94,
        cgst:   100,
        sgst:   100,
        igst:    95,
        total:   W - (70 + 94 + 100 + 100 + 95), // 80.28 pt
      };

      const taxColX = {
        hsn:     L,
        taxable: L + taxCols.hsn,
        cgst:    L + taxCols.hsn + taxCols.taxable,
        sgst:    L + taxCols.hsn + taxCols.taxable + taxCols.cgst,
        igst:    L + taxCols.hsn + taxCols.taxable + taxCols.cgst + taxCols.sgst,
        total:   L + taxCols.hsn + taxCols.taxable + taxCols.cgst + taxCols.sgst + taxCols.igst,
      };

      // Header 1: Category Titles
      doc.rect(taxColX.hsn, y, taxCols.hsn, taxTableH1 + taxTableH2).fillAndStroke(lightBg, black);
      doc.rect(taxColX.taxable, y, taxCols.taxable, taxTableH1 + taxTableH2).fillAndStroke(lightBg, black);
      doc.rect(taxColX.cgst, y, taxCols.cgst, taxTableH1).fillAndStroke(lightBg, black);
      doc.rect(taxColX.sgst, y, taxCols.sgst, taxTableH1).fillAndStroke(lightBg, black);
      doc.rect(taxColX.igst, y, taxCols.igst, taxTableH1).fillAndStroke(lightBg, black);
      doc.rect(taxColX.total, y, taxCols.total, taxTableH1 + taxTableH2).fillAndStroke(lightBg, black);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('HSN/SAC', taxColX.hsn, y + 10, { width: taxCols.hsn, align: 'center' });
      doc.text('Taxable Value (Rs.)', taxColX.taxable, y + 10, { width: taxCols.taxable, align: 'center' });
      doc.text('Central Tax (CGST)', taxColX.cgst, y + 3.5, { width: taxCols.cgst, align: 'center' });
      doc.text('State Tax (SGST)', taxColX.sgst, y + 3.5, { width: taxCols.sgst, align: 'center' });
      doc.text('Integrated Tax (IGST)', taxColX.igst, y + 3.5, { width: taxCols.igst, align: 'center' });
      doc.text('Total Tax (Rs.)', taxColX.total, y + 10, { width: taxCols.total, align: 'center' });

      // Header 2: Sub-columns (Rate % / Amount Rs.)
      const subY = y + taxTableH1;
      const halfCgst = taxCols.cgst / 2;
      const halfSgst = taxCols.sgst / 2;
      const halfIgst = taxCols.igst / 2;

      doc.rect(taxColX.cgst, subY, halfCgst, taxTableH2).stroke();
      doc.rect(taxColX.cgst + halfCgst, subY, halfCgst, taxTableH2).stroke();
      doc.rect(taxColX.sgst, subY, halfSgst, taxTableH2).stroke();
      doc.rect(taxColX.sgst + halfSgst, subY, halfSgst, taxTableH2).stroke();
      doc.rect(taxColX.igst, subY, halfIgst, taxTableH2).stroke();
      doc.rect(taxColX.igst + halfIgst, subY, halfIgst, taxTableH2).stroke();

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(textMuted);
      doc.text('Rate', taxColX.cgst, subY + 3, { width: halfCgst, align: 'center' });
      doc.text('Amount (Rs.)', taxColX.cgst + halfCgst, subY + 3, { width: halfCgst, align: 'center' });
      doc.text('Rate', taxColX.sgst, subY + 3, { width: halfSgst, align: 'center' });
      doc.text('Amount (Rs.)', taxColX.sgst + halfSgst, subY + 3, { width: halfSgst, align: 'center' });
      doc.text('Rate', taxColX.igst, subY + 3, { width: halfIgst, align: 'center' });
      doc.text('Amount (Rs.)', taxColX.igst + halfIgst, subY + 3, { width: halfIgst, align: 'center' });

      y += taxTableH1 + taxTableH2;

      // Data Row for Tax Analysis
      doc.rect(taxColX.hsn, y, taxCols.hsn, taxDataRowH).stroke();
      doc.rect(taxColX.taxable, y, taxCols.taxable, taxDataRowH).stroke();
      doc.rect(taxColX.cgst, y, halfCgst, taxDataRowH).stroke();
      doc.rect(taxColX.cgst + halfCgst, y, halfCgst, taxDataRowH).stroke();
      doc.rect(taxColX.sgst, y, halfSgst, taxDataRowH).stroke();
      doc.rect(taxColX.sgst + halfSgst, y, halfSgst, taxDataRowH).stroke();
      doc.rect(taxColX.igst, y, halfIgst, taxDataRowH).stroke();
      doc.rect(taxColX.igst + halfIgst, y, halfIgst, taxDataRowH).stroke();
      doc.rect(taxColX.total, y, taxCols.total, taxDataRowH).stroke();

      const totalTaxAmt = (Number(bill.cgstAmount) || 0) + (Number(bill.sgstAmount) || 0) + (Number(bill.igstAmount) || 0);

      doc.font('Helvetica').fontSize(7.5).fillColor(black);
      doc.text(hsnCode, taxColX.hsn, y + 5.5, { width: taxCols.hsn, align: 'center' });
      doc.text(`${actualTaxable.toFixed(2)}`, taxColX.taxable, y + 5.5, { width: taxCols.taxable - 6, align: 'right' });

      // CGST
      doc.text(bill.cgstRate || '0%', taxColX.cgst, y + 5.5, { width: halfCgst, align: 'center' });
      doc.text(bill.cgstAmount ? Number(bill.cgstAmount).toFixed(2) : '0.00', taxColX.cgst + halfCgst, y + 5.5, { width: halfCgst - 4, align: 'right' });

      // SGST
      doc.text(bill.sgstRate || '0%', taxColX.sgst, y + 5.5, { width: halfSgst, align: 'center' });
      doc.text(bill.sgstAmount ? Number(bill.sgstAmount).toFixed(2) : '0.00', taxColX.sgst + halfSgst, y + 5.5, { width: halfSgst - 4, align: 'right' });

      // IGST
      doc.text(bill.igstRate || '0%', taxColX.igst, y + 5.5, { width: halfIgst, align: 'center' });
      doc.text(bill.igstAmount ? Number(bill.igstAmount).toFixed(2) : '0.00', taxColX.igst + halfIgst, y + 5.5, { width: halfIgst - 4, align: 'right' });

      // Total Tax
      doc.font('Helvetica-Bold');
      doc.text(`${totalTaxAmt.toFixed(2)}`, taxColX.total, y + 5.5, { width: taxCols.total - 6, align: 'right' });

      y += taxDataRowH;

      // ══════════════════════════════════════════════════════════════════════
      // 6. TOTAL SUMMARY & INVOICE AMOUNT IN WORDS (STATUTORY REQUIREMENT)
      // ══════════════════════════════════════════════════════════════════════
      const summaryH = 50;
      const sumLeftW = Math.floor(W * 0.58); // 312 pt
      const sumRightW = W - sumLeftW;        // 227.28 pt

      doc.rect(L, y, sumLeftW, summaryH).lineWidth(lineW).strokeColor(black).stroke();
      doc.rect(L + sumLeftW, y, sumRightW, summaryH).lineWidth(lineW).strokeColor(black).stroke();

      const finalAmount = bill.grandTotal || bill.total || (actualTaxable + totalTaxAmt);

      // --- Left Box: Amount in Words ---
      doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted);
      doc.text('TOTAL INVOICE AMOUNT IN WORDS (STATUTORY):', L + 6, y + 5);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text(numberToWords(finalAmount), L + 6, y + 16, { width: sumLeftW - 12, lineGap: 1 });

      if (totalTaxAmt > 0) {
        doc.font('Helvetica').fontSize(6.8).fillColor(textMuted);
        doc.text(`Tax Amount: ${numberToWords(totalTaxAmt)}`, L + 6, y + 36, { width: sumLeftW - 12 });
      }

      // --- Right Box: Detailed Breakdown & Grand Total ---
      let sumY = y + 4;
      const rightRows = [
        { label: 'Taxable Amount', value: `Rs. ${actualTaxable.toFixed(2)}` },
        { label: 'Total Tax (CGST+SGST+IGST)', value: `Rs. ${totalTaxAmt.toFixed(2)}` },
      ];

      rightRows.forEach((row) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(textMuted);
        doc.text(row.label, L + sumLeftW + 6, sumY);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
        doc.text(row.value, L + sumLeftW, sumY, { width: sumRightW - 8, align: 'right' });
        sumY += 10.5;
      });

      // Grand Total Highlight Banner inside Right Box
      const gtBoxH = 18;
      doc.rect(L + sumLeftW, y + summaryH - gtBoxH, sumRightW, gtBoxH).fillAndStroke(lightBg, black);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text('GRAND TOTAL (INR):', L + sumLeftW + 6, y + summaryH - gtBoxH + 4.5);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(black);
      doc.text(`Rs. ${finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, L + sumLeftW, y + summaryH - gtBoxH + 4, {
        width: sumRightW - 8,
        align: 'right',
      });

      y += summaryH;

      // ══════════════════════════════════════════════════════════════════════
      // 7. BANK REMITTANCE DETAILS & TERMS (LEFT 55%) | SIGNATURE (RIGHT 45%)
      // ══════════════════════════════════════════════════════════════════════
      const footerH = 92;
      const fLeftW = Math.floor(W * 0.58);
      const fRightW = W - fLeftW;

      doc.rect(L, y, fLeftW, footerH).lineWidth(lineW).strokeColor(black).stroke();
      doc.rect(L + fLeftW, y, fRightW, footerH).lineWidth(lineW).strokeColor(black).stroke();

      // --- Left Box: Bank Details + Legal Terms ---
      doc.font('Helvetica-Bold').fontSize(7).fillColor(black);
      doc.text('ELECTRONIC BANK REMITTANCE DETAILS:', L + 6, y + 5);

      const bankInfo = [
        { l: 'Bank Name', v: settings.bankName || 'KARUR VYSYA BANK' },
        { l: 'A/c Name', v: settings.businessName || 'VIJAYA DURGA AGENCIES' },
        { l: 'Current A/c No.', v: settings.accountNo || '4805135000002964' },
        { l: 'IFSC Code', v: settings.ifsc || 'KVBL0004815' },
        { l: 'Branch', v: settings.branch || 'Narasapur' },
      ];

      let bnkY = y + 16;
      bankInfo.forEach((item) => {
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(textMuted);
        doc.text(`${item.l} : `, L + 6, bnkY, { continued: true });
        doc.font('Helvetica').fontSize(6.8).fillColor(black);
        doc.text(item.v);
        bnkY += 9;
      });

      // Divider Line inside left box
      doc.moveTo(L + 6, bnkY + 2).lineTo(L + fLeftW - 6, bnkY + 2).lineWidth(0.4).strokeColor('#cbd5e1').stroke();

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(textMuted);
      doc.text('DECLARATION & TERMS OF SALE:', L + 6, bnkY + 5);
      doc.font('Helvetica').fontSize(6).fillColor('#4b5563');
      doc.text(
        '1. Certified that all particulars stated above are true and correct. 2. Goods once sold will not be accepted back. 3. Disputes are subject to local court jurisdiction.',
        L + 6,
        bnkY + 14,
        { width: fLeftW - 12, lineGap: 1 }
      );

      // --- Right Box: Signatory Box ---
      const sigX = L + fLeftW;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(black);
      doc.text(`For ${settings.businessName || 'VIJAYA DURGA AGENCIES'}`, sigX + 6, y + 8, {
        width: fRightW - 12,
        align: 'center',
      });

      // Signature line & stamp prompt
      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94a3b8');
      doc.text('[ Signature / Official Stamp ]', sigX + 6, y + footerH - 32, {
        width: fRightW - 12,
        align: 'center',
      });

      doc.moveTo(sigX + 28, y + footerH - 18).lineTo(sigX + fRightW - 28, y + footerH - 18).lineWidth(0.5).strokeColor(black).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(black);
      doc.text('AUTHORISED SIGNATORY', sigX + 6, y + footerH - 14, {
        width: fRightW - 12,
        align: 'center',
        characterSpacing: 0.5,
      });

      y += footerH;

      // ══════════════════════════════════════════════════════════════════════
      // 8. FOOTER NOTE: COMPUTER GENERATED DOCUMENT
      // ══════════════════════════════════════════════════════════════════════
      doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
      doc.text(
        'This is a Computer Generated Tax Invoice issued in accordance with the provisions of the Central Goods and Services Tax Act, 2017.',
        L,
        y + 5,
        { width: W, align: 'center' }
      );

      // ══════════════════════════════════════════════════════════════════════
      // 9. IF BILL IS VOIDED: OFFICIAL DIAGONAL CANCELLATION STAMP
      // ══════════════════════════════════════════════════════════════════════
      if (bill.isVoided) {
        doc.save();
        doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font('Helvetica-Bold').fontSize(44).fillColor('#dc2626', 0.22);
        doc.text('*** CANCELLED / VOID INVOICE ***', 0, doc.page.height / 2 - 30, {
          width: doc.page.width,
          align: 'center',
        });
        if (bill.voidReason) {
          doc.font('Helvetica').fontSize(14).fillColor('#dc2626', 0.25);
          doc.text(`Reason: ${bill.voidReason}`, 0, doc.page.height / 2 + 18, {
            width: doc.page.width,
            align: 'center',
          });
        }
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateBillPDFBuffer };

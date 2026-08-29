const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');
const logos = require('../assets/logosData');
const ganeshaBase64 = (logos.ganeshaBase64 || logos.GANESHA_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');
const durgaBase64 = (logos.durgaBase64 || logos.DURGA_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');
const ramDarbarBase64 = (logos.ramDarbarBase64 || logos.RAM_DARBAR_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');

// Pre-cached in-memory binary image buffers (zero encoding overhead per request)
const ganeshaBuffer = Buffer.from(ganeshaBase64, 'base64');
const durgaBuffer = Buffer.from(durgaBase64, 'base64');
const ramDarbarBuffer = Buffer.from(ramDarbarBase64, 'base64');

/**
 * Generate Traditional Indian Trade Invoice for VIJAYA DURGA AGENCIES
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
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const L = 28;                           // left margin
      const R = doc.page.width - 28;          // right edge
      const W = R - L;                        // content width (539 pt)
      const primaryBlue = '#0b5394';          // Classic receipt royal blue
      const borderBlue = '#0b5394';
      const textDark = '#000000';
      const lineW = 0.85;

      let y = 28;

      // ═══════════════════════════════════════════════════════
      // 1. TOP BAR (TAX INVOICE [Left] | JAI SHREE RAM [Center] | CELL [Right])
      // ═══════════════════════════════════════════════════════
      const row1H = 20;
      doc.lineWidth(lineW).strokeColor(borderBlue);
      doc.rect(L, y, W, row1H).stroke();

      // Top Left: TAX INVOICE / CASH / CREDIT
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('TAX INVOICE / CASH / CREDIT', L + 8, y + 5.5, { align: 'left' });

      // Top Center: Divine Invocation
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
      doc.text('|| JAI SHREE RAM ||', L, y + 5.5, { width: W, align: 'center' });

      // Top Right: Cell
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text(`Cell: ${settings.phone || '9441429745'}`, L + 8, y + 5.5, { width: W - 16, align: 'right' });

      y += row1H;

      // ═══════════════════════════════════════════════════════
      // 2. MAIN HEADER (Lord Vinayaka - Maa Durga - Ram Darbar)
      // ═══════════════════════════════════════════════════════
      const headerBoxH = 76;
      doc.rect(L, y, W, headerBoxH).strokeColor(borderBlue).lineWidth(lineW).stroke();

      const sideLogoSize = 58;
      const sideLogoY = y + 8;

      // Left: Lord Vinayaka (Ganesha) Logo from Buffer
      try {
        doc.image(ganeshaBuffer, L + 10, sideLogoY, { width: sideLogoSize, height: sideLogoSize });
      } catch (e) {
        console.error('Ganesha logo error:', e);
      }

      // Right: Ram Darbar Logo from Buffer
      try {
        doc.image(ramDarbarBuffer, R - sideLogoSize - 10, sideLogoY, { width: sideLogoSize, height: sideLogoSize });
      } catch (e) {
        console.error('Ram Darbar logo error:', e);
      }

      // Center Column
      const centerW = W - (sideLogoSize * 2) - 40;
      const centerX = L + sideLogoSize + 20;

      // Center Top: Maa Durga Emblem from Buffer
      const durgaSize = 28;
      try {
        doc.image(durgaBuffer, centerX + (centerW / 2) - (durgaSize / 2), y + 4, {
          width: durgaSize,
          height: durgaSize,
        });
      } catch (e) {
        console.error('Durga logo error:', e);
      }

      // Center Trade Name
      doc
        .font('Helvetica-Bold')
        .fontSize(17)
        .fillColor(primaryBlue)
        .text(settings.businessName || 'VIJAYA DURGA AGENCIES', centerX, y + 33, {
          width: centerW,
          align: 'center',
          characterSpacing: 0.5,
        });

      // Sub-heading: Legal Name & GSTIN
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(textDark)
        .text(`Prop: ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}   |   GSTIN: ${settings.gstin || '37KATPS1500Q1ZR'}`, centerX, y + 52, {
          width: centerW,
          align: 'center',
        });

      // Address line
      doc
        .font('Helvetica')
        .fontSize(6.8)
        .fillColor('#333333')
        .text(
          settings.address || 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
          centerX - 10,
          y + 62,
          { width: centerW + 20, align: 'center' }
        );

      y += headerBoxH;

      // ═══════════════════════════════════════════════════════
      // 3. NO. & DATE ROW (Split 50-50)
      // ═══════════════════════════════════════════════════════
      const row3H = 20;
      const halfW = W / 2;
      doc.rect(L, y, halfW, row3H).stroke();
      doc.rect(L + halfW, y, halfW, row3H).stroke();

      const billDate = new Date(bill.date);
      const dd = String(billDate.getDate()).padStart(2, '0');
      const mm = String(billDate.getMonth() + 1).padStart(2, '0');
      const yyyy = billDate.getFullYear();
      const formattedDate = `${dd}-${mm}-${yyyy}`;

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text('No.', L + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#b12704');
      doc.text(` ${bill.billNo}`, L + 30, y + 4.5);

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text(`Date: `, L + halfW + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark);
      doc.text(`${formattedDate}`, L + halfW + 40, y + 5);

      y += row3H;

      // ═══════════════════════════════════════════════════════
      // 4. M/S CUSTOMER NAME ROW
      // ═══════════════════════════════════════════════════════
      const row4H = 22;
      doc.rect(L, y, W, row4H).stroke();

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text('M/s', L + 8, y + 6);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(textDark);
      doc.text(bill.companyName, L + 36, y + 5);

      y += row4H;

      // ═══════════════════════════════════════════════════════
      // 5. CUSTOMER GSTIN & CELL ROW
      // ═══════════════════════════════════════════════════════
      const row5H = 20;
      doc.rect(L, y, W, row5H).stroke();

      const customerGstin = bill.companyGstin || settings.gstin || '';

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('GSTIN : ', L + 8, y + 5.5);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
      doc.text(`${customerGstin}`, L + 50, y + 5.5);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('Cell : ', L + W - 140, y + 5.5);
      if (bill.customerPhone) {
        doc.font('Helvetica').fontSize(8.5).fillColor(textDark);
        doc.text(bill.customerPhone, L + W - 105, y + 5.5);
      }

      y += row5H;

      // ═══════════════════════════════════════════════════════
      // 6. MODERN ITEMS TABLE
      // ═══════════════════════════════════════════════════════
      const cols = {
        sno:    32,
        part:   190,
        hsn:    50,
        qty:    55,
        price:  60,
        tax:    54,
        amt:    W - 32 - 190 - 50 - 55 - 60 - 54, // 98 pt
      };

      const colX = {
        sno:   L,
        part:  L + cols.sno,
        hsn:   L + cols.sno + cols.part,
        qty:   L + cols.sno + cols.part + cols.hsn,
        price: L + cols.sno + cols.part + cols.hsn + cols.qty,
        tax:   L + cols.sno + cols.part + cols.hsn + cols.qty + cols.price,
        amt:   L + cols.sno + cols.part + cols.hsn + cols.qty + cols.price + cols.tax,
      };

      // Table Header Row with subtle modern tint
      const thH = 24;
      doc.rect(L, y, W, thH).fillAndStroke('#f0f5fa', borderBlue);

      // Header cell borders
      Object.keys(cols).forEach((key) => {
        doc.rect(colX[key], y, cols[key], thH).stroke();
      });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryBlue);
      const thY = y + 4;
      doc.text('S.\nNo.', colX.sno + 2, thY, { width: cols.sno - 4, align: 'center' });
      doc.text('PARTICULARS', colX.part + 4, y + 8, { width: cols.part - 8, align: 'center' });
      doc.text('HSN', colX.hsn + 2, y + 8, { width: cols.hsn - 4, align: 'center' });
      doc.text('QTY.', colX.qty + 2, y + 8, { width: cols.qty - 4, align: 'center' });
      doc.text('PRICE', colX.price + 2, y + 8, { width: cols.price - 4, align: 'center' });
      doc.text('RATE\nOF TAX', colX.tax + 2, thY, { width: cols.tax - 4, align: 'center' });
      doc.text('AMOUNT\nRs.       Ps.', colX.amt + 2, thY, { width: cols.amt - 4, align: 'center' });

      y += thH;

      // Render items
      const itemsList = bill.items && bill.items.length > 0 ? bill.items : [{
        sno: 1,
        particulars: bill.particulars || 'Fresh Seafood / Prawns Supply',
        hsn: bill.hsn || '0306',
        quantity: bill.quantity,
        rate: bill.rate,
        taxRate: '',
        amount: bill.total,
      }];

      const itemRowH = 24;
      itemsList.forEach((item, index) => {
        Object.keys(cols).forEach((key) => {
          doc.rect(colX[key], y, cols[key], itemRowH).stroke();
        });

        doc.font('Helvetica').fontSize(9).fillColor(textDark);
        doc.text(String(index + 1), colX.sno + 2, y + 7, { width: cols.sno - 4, align: 'center' });
        doc.font('Helvetica-Bold').text(item.particulars || 'Fresh Seafood / Prawns Supply', colX.part + 6, y + 7, { width: cols.part - 12 });
        doc.font('Helvetica').fontSize(8.5).text(item.hsn || '0306', colX.hsn + 2, y + 7, { width: cols.hsn - 4, align: 'center' });
        
        // Clean regular font for Qty (not overly bold)
        doc.font('Helvetica').fontSize(9);
        doc.text(`${item.quantity} kg`, colX.qty + 2, y + 7, { width: cols.qty - 4, align: 'center' });
        doc.text(`${Number(item.rate).toFixed(2)}`, colX.price + 2, y + 7, { width: cols.price - 8, align: 'right' });
        doc.text(item.taxRate || '', colX.tax + 2, y + 7, { width: cols.tax - 4, align: 'center' });
        doc.font('Helvetica-Bold');
        doc.text(`${Number(item.amount).toFixed(2)}`, colX.amt + 2, y + 7, { width: cols.amt - 10, align: 'right' });

        y += itemRowH;
      });

      // Clean empty rows for receipt format
      const maxReceiptRows = 6;
      const emptyRowsCount = Math.max(1, maxReceiptRows - itemsList.length);
      const emptyRowH = 18;
      for (let i = 0; i < emptyRowsCount; i++) {
        Object.keys(cols).forEach((key) => {
          doc.rect(colX[key], y, cols[key], emptyRowH).stroke();
        });
        y += emptyRowH;
      }

      // ── Table TOTAL Row ──
      const totalRowH = 25;
      const totalLabelW = cols.sno + cols.part + cols.hsn + cols.qty + cols.price;

      doc.rect(L, y, totalLabelW, totalRowH).fillAndStroke('#f0f5fa', borderBlue);
      doc.rect(L + totalLabelW, y, cols.tax, totalRowH).stroke();
      doc.rect(colX.amt, y, cols.amt, totalRowH).fillAndStroke('#f0f5fa', borderBlue);

      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(primaryBlue);
      doc.text('TOTAL', L + 8, y + 7, { width: totalLabelW - 16, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark);
      doc.text(`${bill.total.toFixed(2)}`, colX.amt + 2, y + 7, { width: cols.amt - 10, align: 'right' });

      y += totalRowH;

      // ═══════════════════════════════════════════════════════
      // 7. TAX BREAKDOWN SECTION (CGST / SGST / IGST)
      // ═══════════════════════════════════════════════════════
      const taxHeaderH = 15;
      const taxColW = {
        taxable: Math.floor(W * 0.22),
        cgstRate: Math.floor(W * 0.11),
        cgstAmt: Math.floor(W * 0.15),
        sgstRate: Math.floor(W * 0.11),
        sgstAmt: Math.floor(W * 0.15),
      };
      taxColW.igstAmt = W - taxColW.taxable - taxColW.cgstRate - taxColW.cgstAmt - taxColW.sgstRate - taxColW.sgstAmt;

      const taxX = {
        taxable: L,
        cgstRate: L + taxColW.taxable,
        cgstAmt: L + taxColW.taxable + taxColW.cgstRate,
        sgstRate: L + taxColW.taxable + taxColW.cgstRate + taxColW.cgstAmt,
        sgstAmt: L + taxColW.taxable + taxColW.cgstRate + taxColW.cgstAmt + taxColW.sgstRate,
        igstAmt: L + taxColW.taxable + taxColW.cgstRate + taxColW.cgstAmt + taxColW.sgstRate + taxColW.sgstAmt,
      };

      // Tax Header
      doc.rect(taxX.taxable, y, taxColW.taxable, taxHeaderH).fillAndStroke('#f0f5fa', borderBlue);
      doc.rect(taxX.cgstRate, y, taxColW.cgstRate + taxColW.cgstAmt, taxHeaderH).fillAndStroke('#f0f5fa', borderBlue);
      doc.rect(taxX.sgstRate, y, taxColW.sgstRate + taxColW.sgstAmt, taxHeaderH).fillAndStroke('#f0f5fa', borderBlue);
      doc.rect(taxX.igstAmt, y, taxColW.igstAmt, taxHeaderH).fillAndStroke('#f0f5fa', borderBlue);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryBlue);
      doc.text('Taxable Value', taxX.taxable + 4, y + 4, { width: taxColW.taxable - 8, align: 'center' });
      doc.text('CGST Tax', taxX.cgstRate + 2, y + 4, { width: taxColW.cgstRate + taxColW.cgstAmt - 4, align: 'center' });
      doc.text('SGST Tax', taxX.sgstRate + 2, y + 4, { width: taxColW.sgstRate + taxColW.sgstAmt - 4, align: 'center' });
      doc.text('IGST Tax', taxX.igstAmt + 2, y + 4, { width: taxColW.igstAmt - 4, align: 'center' });

      y += taxHeaderH;

      // Tax sub-header
      const taxSubH = 13;
      doc.rect(taxX.taxable, y, taxColW.taxable, taxSubH).stroke();
      doc.rect(taxX.cgstRate, y, taxColW.cgstRate, taxSubH).stroke();
      doc.rect(taxX.cgstAmt, y, taxColW.cgstAmt, taxSubH).stroke();
      doc.rect(taxX.sgstRate, y, taxColW.sgstRate, taxSubH).stroke();
      doc.rect(taxX.sgstAmt, y, taxColW.sgstAmt, taxSubH).stroke();
      doc.rect(taxX.igstAmt, y, taxColW.igstAmt, taxSubH).stroke();

      doc.font('Helvetica').fontSize(7).fillColor(primaryBlue);
      doc.text('', taxX.taxable + 4, y + 3);
      doc.text('Rate', taxX.cgstRate + 2, y + 3, { width: taxColW.cgstRate - 4, align: 'center' });
      doc.text('Amount', taxX.cgstAmt + 2, y + 3, { width: taxColW.cgstAmt - 4, align: 'center' });
      doc.text('Rate', taxX.sgstRate + 2, y + 3, { width: taxColW.sgstRate - 4, align: 'center' });
      doc.text('Amount', taxX.sgstAmt + 2, y + 3, { width: taxColW.sgstAmt - 4, align: 'center' });
      doc.text('Amount', taxX.igstAmt + 2, y + 3, { width: taxColW.igstAmt - 4, align: 'center' });

      y += taxSubH;

      // Tax data row
      const taxDataH = 18;
      doc.rect(taxX.taxable, y, taxColW.taxable, taxDataH).stroke();
      doc.rect(taxX.cgstRate, y, taxColW.cgstRate, taxDataH).stroke();
      doc.rect(taxX.cgstAmt, y, taxColW.cgstAmt, taxDataH).stroke();
      doc.rect(taxX.sgstRate, y, taxColW.sgstRate, taxDataH).stroke();
      doc.rect(taxX.sgstAmt, y, taxColW.sgstAmt, taxDataH).stroke();
      doc.rect(taxX.igstAmt, y, taxColW.igstAmt, taxDataH).stroke();

      if (bill.taxableValue > 0 || bill.cgstAmount > 0 || bill.sgstAmount > 0 || bill.igstAmount > 0) {
        doc.font('Helvetica').fontSize(8).fillColor(textDark);
        if (bill.taxableValue) doc.text(`${Number(bill.taxableValue).toFixed(2)}`, taxX.taxable + 2, y + 5, { width: taxColW.taxable - 4, align: 'center' });
        if (bill.cgstRate) doc.text(bill.cgstRate, taxX.cgstRate + 2, y + 5, { width: taxColW.cgstRate - 4, align: 'center' });
        if (bill.cgstAmount) doc.text(`${Number(bill.cgstAmount).toFixed(2)}`, taxX.cgstAmt + 2, y + 5, { width: taxColW.cgstAmt - 4, align: 'center' });
        if (bill.sgstRate) doc.text(bill.sgstRate, taxX.sgstRate + 2, y + 5, { width: taxColW.sgstRate - 4, align: 'center' });
        if (bill.sgstAmount) doc.text(`${Number(bill.sgstAmount).toFixed(2)}`, taxX.sgstAmt + 2, y + 5, { width: taxColW.sgstAmt - 4, align: 'center' });
        if (bill.igstAmount) doc.text(`${Number(bill.igstAmount).toFixed(2)}`, taxX.igstAmt + 2, y + 5, { width: taxColW.igstAmt - 4, align: 'center' });
      }

      y += taxDataH;

      // ═══════════════════════════════════════════════════════
      // 8. DEDICATED GRAND TOTAL BOX (AFTER TAX TABLE)
      // ═══════════════════════════════════════════════════════
      const grandTotalH = 26;
      const gtLabelW = W - cols.amt;
      const finalAmount = bill.grandTotal || bill.total;

      doc.rect(L, y, gtLabelW, grandTotalH).fillAndStroke('#e8f1f8', borderBlue);
      doc.rect(L + gtLabelW, y, cols.amt, grandTotalH).fillAndStroke('#e8f1f8', borderBlue);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryBlue);
      doc.text('GRAND TOTAL', L + 8, y + 7, { width: gtLabelW - 16, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(textDark);
      doc.text(`${finalAmount.toFixed(2)}`, colX.amt + 2, y + 7, { width: cols.amt - 10, align: 'right' });

      y += grandTotalH;

      // ═══════════════════════════════════════════════════════
      // 9. FOOTER: Bank Details (Left) + Proprietor Signature (Right)
      // ═══════════════════════════════════════════════════════
      const footerH = 68;
      const footerLeftW = Math.floor(W * 0.50);
      const footerRightW = W - footerLeftW;

      doc.rect(L, y, footerLeftW, footerH).stroke();
      doc.rect(L + footerLeftW, y, footerRightW, footerH).stroke();

      // Left Box: Exact Bank Details from Cheque
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
      doc.text(`BANK : ${settings.bankName || 'KARUR VYSYA BANK'}`, L + 8, y + 7);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textDark);
      doc.text(`A/c. NO : `, L + 8, y + 19, { continued: true });
      doc.font('Helvetica').text(`${settings.accountNo || '4805135000002964'}`);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textDark);
      doc.text(`IFSC    : `, L + 8, y + 30, { continued: true });
      doc.font('Helvetica').text(`${settings.ifsc || 'KVBL0004815'}`);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(textDark);
      doc.text(`Branch  : `, L + 8, y + 41, { continued: true });
      doc.font('Helvetica').text(`${settings.branch || 'Narasapur'}`);

      doc.font('Helvetica').fontSize(6.8).fillColor('#444444');
      doc.text('Goods once sold will not be taken back. Subject to local Jurisdiction.', L + 8, y + 54);

      // Right Box: Signature
      const sigX = L + footerLeftW;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text(`For ${settings.businessName || 'VIJAYA DURGA AGENCIES'}`, sigX + 8, y + 8, {
        width: footerRightW - 16,
        align: 'center',
      });

      // Signature line
      doc
        .moveTo(sigX + 35, y + footerH - 18)
        .lineTo(sigX + footerRightW - 35, y + footerH - 18)
        .strokeColor(primaryBlue)
        .lineWidth(0.5)
        .stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('Proprietor', sigX + 8, y + footerH - 14, { width: footerRightW - 16, align: 'center' });

      y += footerH;

      // ── If Bill is Voided, draw prominent VOID watermark across document ──
      if (bill.isVoided) {
        doc.save();
        doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font('Helvetica-Bold').fontSize(52).fillColor('#dc2626', 0.28);
        doc.text('*** VOID / CANCELLED ***', 0, doc.page.height / 2 - 26, {
          width: doc.page.width,
          align: 'center',
        });
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convert number to words (Indian Currency Format)
 */
function numberToWords(num) {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelow1000(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  }

  const intPart = Math.floor(num);
  const parts = [];

  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const remainder = intPart % 1000;

  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertBelow1000(remainder));

  return parts.join(' ') + ' Rupees Only';
}

module.exports = { generateBillPDFBuffer };

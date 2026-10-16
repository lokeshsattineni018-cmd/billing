const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const logos = require('../assets/logosData');

const ganeshaBase64 = (logos.ganeshaBase64 || logos.GANESHA_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');
const durgaBase64 = (logos.durgaBase64 || logos.DURGA_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');
const ramDarbarBase64 = (logos.ramDarbarBase64 || logos.RAM_DARBAR_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');
const teluguJaiShreeRamBase64 = (logos.JAI_SHREE_RAM_TELUGU_BASE64 || '').replace(/^data:image\/\w+;base64,/, '');

const ganeshaBuffer = Buffer.from(ganeshaBase64, 'base64');
const durgaBuffer = Buffer.from(durgaBase64, 'base64');
const ramDarbarBuffer = Buffer.from(ramDarbarBase64, 'base64');
const teluguJaiShreeRamBuffer = Buffer.from(teluguJaiShreeRamBase64, 'base64');

const teluguFontPath = path.join(__dirname, '../assets/NotoSansTelugu-Bold.ttf');

function numberToWords(num) {
  if (!num || num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelow1000(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
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

function formatDateStr(d) {
  if (!d) return '';
  const dateObj = new Date(d);
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generate Voucher PDF Buffer (Ice Bill, Worker Bill, Worker Statement)
 * Designed to exactly mirror the official in-app document layout.
 */
async function generateVoucherPDFBuffer({ type = 'worker', data = {}, voucherNo = '' }) {
  return new Promise(async (resolve, reject) => {
    try {
      let settings = null;
      try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          settings = await Settings.findOne().lean();
        }
      } catch (err) {
        // Fallback default settings
      }

      if (!settings) {
        settings = {
          businessName: 'VIJAYA DURGA SEA FOODS',
          proprietor: 'SATTINENI VENKATA DHANA LAXMI',
          gstin: '37KATPS1500Q1ZR',
          address: 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
          phone: '9441429745',
          bankDetails: {
            bankName: 'KARUR VYSYA BANK',
            accountNo: '4805135000002964',
            ifsc: 'KVBL0004815',
            branch: 'Narasapur',
          },
        };
      }

      const resolvedVoucherNo = voucherNo || data.voucherNo || (type === 'ice' ? 'ICE-1' : type === 'wastage' ? 'WASTE-1' : type === 'worker' ? 'WB-1' : `STMT-${data.workerName || 'ALL'}`);

      const docTitle =
        type === 'ice'
          ? `Ice Bill ${resolvedVoucherNo}`
          : type === 'wastage'
          ? `Wastage Sale Bill ${resolvedVoucherNo}`
          : type === 'worker'
          ? `Worker Bill ${resolvedVoucherNo}`
          : `Worker Statement - ${data.workerName || 'Worker'}`;

      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: docTitle,
          Author: settings.businessName || 'VIJAYA DURGA SEA FOODS',
          Subject: type === 'statement' ? 'Worker Wage Statement' : type === 'ice' ? 'Ice Procurement Bill' : type === 'wastage' ? 'Prawn Wastage Sale Bill' : 'Worker Wage Bill',
        },
      });

      if (fs.existsSync(teluguFontPath)) {
        try {
          doc.registerFont('TeluguFont', teluguFontPath);
        } catch (e) {
          console.warn('Could not register TeluguFont:', e.message);
        }
      }

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const L = 28;
      const R = doc.page.width - 28;
      const W = R - L; // 539.28 pt
      const primaryBlue = '#0b5394';
      const borderBlue = '#0b5394';
      const textDark = '#000000';
      const lineW = 0.85;

      // Helper to render table headers with currency symbols cleanly without broken glyphs
      function renderHeaderWithRupee(text, x, y, width, align = 'center') {
        if (!text.includes('₹') || !doc._fontFamilies?.['TeluguFont']) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue).text(text.replace('₹', 'Rs.'), x, y, { width, align });
          return;
        }
        const parts = text.split('₹');
        const before = parts[0];
        const after = parts[1];
        doc.font('Helvetica-Bold').fontSize(8.5);
        const w1 = doc.widthOfString(before);
        doc.font('TeluguFont').fontSize(8.5);
        const wRupee = doc.widthOfString('₹');
        doc.font('Helvetica-Bold').fontSize(8.5);
        const w2 = doc.widthOfString(after);
        const totalW = w1 + wRupee + w2;

        let startX = x;
        if (align === 'center') {
          startX = x + (width - totalW) / 2;
        } else if (align === 'right') {
          startX = x + width - totalW;
        }

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue).text(before, startX, y, { continued: true });
        doc.font('TeluguFont').fontSize(8.5).fillColor(primaryBlue).text('₹', { continued: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue).text(after);
      }

      // Helper to render formatted currency amounts cleanly
      function renderAmount(num, x, y, width, align = 'right', fontSize = 9, isBold = false, color = '#000000') {
        const valStr = `₹${Number(num || 0).toFixed(2)}`;
        if (doc._fontFamilies?.['TeluguFont']) {
          doc.font('TeluguFont').fontSize(fontSize).fillColor(color).text(valStr, x, y, { width, align });
        } else {
          doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color).text(`Rs. ${Number(num || 0).toFixed(2)}`, x, y, { width, align });
        }
      }

      let y = 28;

      // 1. TOP BAR
      const row1H = 20;
      doc.lineWidth(lineW).strokeColor(borderBlue);
      doc.rect(L, y, W, row1H).stroke();

      const topTitle =
        type === 'ice'
          ? 'ICE BILL'
          : type === 'wastage'
          ? 'PRAWN WASTAGE SALE BILL'
          : type === 'worker'
          ? 'WORKER BILL'
          : 'WORKER WAGE STATEMENT & SETTLEMENT BILL';

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text(topTitle, L + 8, y + 5.5, { align: 'left' });

      // Telugu invocation || జై శ్రీరామ్ ||
      if (teluguJaiShreeRamBuffer && teluguJaiShreeRamBuffer.length > 0) {
        const teluguImgW = 68;
        const teluguImgH = 14;
        const teluguImgX = L + (W - teluguImgW) / 2;
        const teluguImgY = y + (row1H - teluguImgH) / 2;
        doc.image(teluguJaiShreeRamBuffer, teluguImgX, teluguImgY, { width: teluguImgW, height: teluguImgH });
      } else {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
        doc.text('|| JAI SHREE RAM ||', L, y + 5.5, { width: W, align: 'center' });
      }

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text(`Cell: ${settings.phone || '9441429745'}`, L + 8, y + 5.5, { width: W - 16, align: 'right' });

      y += row1H;

      // 2. MAIN HEADER (Ganesha - Durga - Ram Darbar)
      const headerBoxH = 82;
      doc.rect(L, y, W, headerBoxH).strokeColor(borderBlue).lineWidth(lineW).stroke();

      const sideLogoSize = 70;
      const sideLogoY = y + 6;

      try {
        doc.image(ganeshaBuffer, L + 8, sideLogoY, { width: sideLogoSize, height: sideLogoSize });
      } catch (e) {}

      try {
        doc.image(ramDarbarBuffer, R - sideLogoSize - 8, sideLogoY, { width: sideLogoSize, height: sideLogoSize });
      } catch (e) {}

      const centerW = W - sideLogoSize * 2 - 24;
      const centerX = L + sideLogoSize + 12;
      const durgaSize = 34;

      try {
        doc.image(durgaBuffer, centerX + centerW / 2 - durgaSize / 2, y + 3, {
          width: durgaSize,
          height: durgaSize,
        });
      } catch (e) {}

      doc
        .font('Helvetica-Bold')
        .fontSize(16.5)
        .fillColor(primaryBlue)
        .text(settings.businessName || 'VIJAYA DURGA SEA FOODS', centerX, y + 37.5, {
          width: centerW,
          align: 'center',
          characterSpacing: 0.5,
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(textDark)
        .text(
          `Prop: ${settings.legalName || settings.proprietor || 'SATTINENI VENKATA DHANA LAXMI'}   |   GSTIN: ${settings.gstin || '37KATPS1500Q1ZR'}`,
          centerX,
          y + 54.5,
          { width: centerW, align: 'center' }
        );

      doc
        .font('Helvetica')
        .fontSize(6.8)
        .fillColor('#333333')
        .text(
          settings.address || 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
          centerX - 10,
          y + 64.5,
          { width: centerW + 20, align: 'center' }
        );

      y += headerBoxH;

      // 3. VOUCHER NUMBER & DATE ROW
      const row3H = 20;
      const halfW = W / 2;
      doc.rect(L, y, halfW, row3H).stroke();
      doc.rect(L + halfW, y, halfW, row3H).stroke();

      const labelNo = type === 'statement' ? 'Statement No.' : 'Voucher No.';
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
      doc.text(labelNo, L + 8, y + 5.5);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#b12704');
      doc.text(` ${resolvedVoucherNo}`, L + 80, y + 5);

      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
      doc.text('Date: ', L + halfW + 8, y + 5.5);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark);
      doc.text(`${formatDateStr(data.date || new Date())}`, L + halfW + 42, y + 5);

      y += row3H;

      // 4. PARTY / DETAILS ROWS
      if (type === 'ice') {
        const row4H = 20;
        doc.rect(L, y, halfW, row4H).stroke();
        doc.rect(L + halfW, y, halfW, row4H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Ice From (Supplier): ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.iceFrom || data.supplierName || 'Sri Rama Ice Plant', L + 105, y + 5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Ice To (Receiver): ', L + halfW + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.iceTo || 'Factory / Cold Storage', L + halfW + 95, y + 5);

        y += row4H;

        // Payment Status full-width row matching Screenshot 2
        const row5H = 20;
        doc.rect(L, y, W, row5H).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Payment Status: ', L + 8, y + 5.5);
        const pStatus = data.paymentStatus || 'Pending';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(pStatus === 'Paid' ? '#16a34a' : '#d97706');
        doc.text(pStatus, L + 88, y + 5);

        y += row5H;
      } else if (type === 'wastage') {
        const row4H = 20;
        doc.rect(L, y, halfW, row4H).stroke();
        doc.rect(L + halfW, y, halfW, row4H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Buyer Name: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.buyerName || '—', L + 75, y + 5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Category: ', L + halfW + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.category || 'Prawn Head', L + halfW + 65, y + 5);

        y += row4H;

        const row5H = 20;
        doc.rect(L, y, halfW, row5H).stroke();
        doc.rect(L + halfW, y, halfW, row5H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Vehicle No: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(data.vehicleNo || '—', L + 70, y + 5.5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Payment Status: ', L + halfW + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(data.paymentStatus === 'Paid' ? '#16a34a' : '#d97706');
        doc.text(data.paymentStatus || 'Paid', L + halfW + 85, y + 5);

        y += row5H;
      } else if (type === 'worker') {
        const row4H = 22;
        doc.rect(L, y, W, row4H).stroke();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
        doc.text('Worker Name: ', L + 8, y + 6);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(textDark);
        doc.text(data.staffName || '', L + 80, y + 5.5);

        if (data.staffPhone) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b');
          doc.text(`Cell: ${data.staffPhone}`, L + 8, y + 6, { width: W - 16, align: 'right' });
        }
        y += row4H;

        const row5H = 20;
        doc.rect(L, y, halfW, row5H).stroke();
        doc.rect(L + halfW, y, halfW, row5H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Work Category & Shift: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(`${data.workType || 'Processing'} (${data.shift || 'Full Day'})`, L + 115, y + 5.5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Payment Status: ', L + halfW + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(data.paymentStatus === 'Paid' ? '#16a34a' : '#d97706');
        doc.text(data.paymentStatus || 'Pending', L + halfW + 85, y + 5);

        y += row5H;
      } else if (type === 'statement') {
        const row4H = 22;
        doc.rect(L, y, W, row4H).stroke();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
        doc.text('Worker Name: ', L + 8, y + 6);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(textDark);
        doc.text(data.workerName || '', L + 80, y + 5.5);

        if (data.summary?.staffPhone) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b');
          doc.text(`Cell: ${data.summary.staffPhone}`, L + 8, y + 6, { width: W - 16, align: 'right' });
        }
        y += row4H;

        const row5H = 20;
        doc.rect(L, y, halfW, row5H).stroke();
        doc.rect(L + halfW, y, halfW, row5H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Days Worked: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(`${data.summary?.daysWorkedCount || data.entries?.length || 0} days`, L + 80, y + 5.5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Total Weight Processed: ', L + halfW + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(`${data.summary?.totalKg || 0} kg`, L + halfW + 125, y + 5.5);

        y += row5H;
      }

      // 5. TABLE SECTION
      if (type === 'ice') {
        const colSNo = 45;
        const colQty = 115;
        const colRate = 105;
        const colAmt = 125;
        const colDesc = W - colSNo - colQty - colRate - colAmt; // ~149.28 pt

        const xSNo = L;
        const xDesc = L + colSNo;
        const xQty = xDesc + colDesc;
        const xRate = xQty + colQty;
        const xAmt = xRate + colRate;

        // Table Header
        const thH = 22;
        doc.rect(xSNo, y, colSNo, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xDesc, y, colDesc, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xQty, y, colQty, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xRate, y, colRate, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xAmt, y, colAmt, thH).fillAndStroke('#f0f5fa', borderBlue);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('S.No.', xSNo, y + 6.5, { width: colSNo, align: 'center' });
        doc.text('Description of Supply', xDesc + 8, y + 6.5, { width: colDesc - 16, align: 'left' });
        doc.text('Quantity', xQty, y + 6.5, { width: colQty, align: 'center' });
        renderHeaderWithRupee('Rate (₹)', xRate, y + 6.5, colRate, 'center');
        renderHeaderWithRupee('Amount (₹)', xAmt, y + 6.5, colAmt - 8, 'right');

        y += thH;

        // Row 1 (ICE)
        const rowH = 26;
        doc.rect(xSNo, y, colSNo, rowH).stroke();
        doc.rect(xDesc, y, colDesc, rowH).stroke();
        doc.rect(xQty, y, colQty, rowH).stroke();
        doc.rect(xRate, y, colRate, rowH).stroke();
        doc.rect(xAmt, y, colAmt, rowH).stroke();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text('1', xSNo, y + 8, { width: colSNo, align: 'center' });
        doc.text('ICE', xDesc + 8, y + 8, { width: colDesc - 16, align: 'left' });
        doc.text(`${data.blocks || 0} blocks`, xQty, y + 8, { width: colQty, align: 'center' });

        renderAmount(data.rate, xRate, y + 8, colRate - 8, 'right', 9, false, textDark);
        renderAmount(data.totalAmount, xAmt, y + 8, colAmt - 8, 'right', 9.5, true, textDark);

        y += rowH;

        // Spacer rows with column dividers matching receipt format
        const emptyRowH = 22;
        for (let i = 0; i < 2; i++) {
          doc.rect(xSNo, y, colSNo, emptyRowH).stroke();
          doc.rect(xDesc, y, colDesc, emptyRowH).stroke();
          doc.rect(xQty, y, colQty, emptyRowH).stroke();
          doc.rect(xRate, y, colRate, emptyRowH).stroke();
          doc.rect(xAmt, y, colAmt, emptyRowH).stroke();
          y += emptyRowH;
        }

        // Total Amount Row (background #e8f1f8)
        const totH = 26;
        doc.rect(L, y, W - colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);
        doc.rect(xAmt, y, colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
        doc.text('TOTAL AMOUNT:', L, y + 7.5, { width: W - colAmt - 12, align: 'right' });

        renderAmount(data.totalAmount, xAmt, y + 6.5, colAmt - 8, 'right', 11, true, '#000000');

        y += totH;

        // Amount in Words Row
        const wordsH = 20;
        doc.rect(L, y, W, wordsH).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('Amount in Words: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(numberToWords(data.totalAmount || 0), L + 88, y + 5.5);

        y += wordsH;
      } else if (type === 'wastage') {
        const colSNo = 45;
        const colQty = 115;
        const colRate = 105;
        const colAmt = 125;
        const colDesc = W - colSNo - colQty - colRate - colAmt;

        const xSNo = L;
        const xDesc = L + colSNo;
        const xQty = xDesc + colDesc;
        const xRate = xQty + colQty;
        const xAmt = xRate + colRate;

        // Table Header
        const thH = 22;
        doc.rect(xSNo, y, colSNo, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xDesc, y, colDesc, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xQty, y, colQty, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xRate, y, colRate, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xAmt, y, colAmt, thH).fillAndStroke('#f0f5fa', borderBlue);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('S.No.', xSNo, y + 6.5, { width: colSNo, align: 'center' });
        doc.text('Description of Sale', xDesc + 8, y + 6.5, { width: colDesc - 16, align: 'left' });
        doc.text('Quantity (boxes)', xQty, y + 6.5, { width: colQty, align: 'center' });
        renderHeaderWithRupee('Rate (₹/box)', xRate, y + 6.5, colRate, 'center');
        renderHeaderWithRupee('Amount (₹)', xAmt, y + 6.5, colAmt - 8, 'right');

        y += thH;

        // Row 1
        const rowH = 26;
        doc.rect(xSNo, y, colSNo, rowH).stroke();
        doc.rect(xDesc, y, colDesc, rowH).stroke();
        doc.rect(xQty, y, colQty, rowH).stroke();
        doc.rect(xRate, y, colRate, rowH).stroke();
        doc.rect(xAmt, y, colAmt, rowH).stroke();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text('1', xSNo, y + 8, { width: colSNo, align: 'center' });
        doc.text(`${data.category || 'Prawn Head'} Wastage`, xDesc + 8, y + 8, { width: colDesc - 16, align: 'left' });
        doc.text(`${data.quantityKg || data.quantity || 0} boxes`, xQty, y + 8, { width: colQty, align: 'center' });

        renderAmount(data.rate, xRate, y + 8, colRate - 8, 'right', 9, false, textDark);
        renderAmount(data.totalAmount, xAmt, y + 8, colAmt - 8, 'right', 9.5, true, textDark);

        y += rowH;

        // Spacer rows
        const emptyRowH = 22;
        for (let i = 0; i < 2; i++) {
          doc.rect(xSNo, y, colSNo, emptyRowH).stroke();
          doc.rect(xDesc, y, colDesc, emptyRowH).stroke();
          doc.rect(xQty, y, colQty, emptyRowH).stroke();
          doc.rect(xRate, y, colRate, emptyRowH).stroke();
          doc.rect(xAmt, y, colAmt, emptyRowH).stroke();
          y += emptyRowH;
        }

        // Total Row
        const totH = 26;
        doc.rect(L, y, W - colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);
        doc.rect(xAmt, y, colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
        doc.text('TOTAL SALE AMOUNT:', L, y + 7.5, { width: W - colAmt - 12, align: 'right' });

        renderAmount(data.totalAmount, xAmt, y + 6.5, colAmt - 8, 'right', 11, true, '#000000');

        y += totH;

        // Words row
        const wordsH = 20;
        doc.rect(L, y, W, wordsH).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('Amount in Words: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(numberToWords(data.totalAmount || 0), L + 88, y + 5.5);

        y += wordsH;
      } else if (type === 'worker') {
        const colSNo = 45;
        const colQty = 115;
        const colRate = 105;
        const colAmt = 125;
        const colDesc = W - colSNo - colQty - colRate - colAmt;

        const xSNo = L;
        const xDesc = L + colSNo;
        const xQty = xDesc + colDesc;
        const xRate = xQty + colQty;
        const xAmt = xRate + colRate;

        // Table Header
        const thH = 22;
        doc.rect(xSNo, y, colSNo, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xDesc, y, colDesc, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xQty, y, colQty, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xRate, y, colRate, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xAmt, y, colAmt, thH).fillAndStroke('#f0f5fa', borderBlue);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('S.No.', xSNo, y + 6.5, { width: colSNo, align: 'center' });
        doc.text('Work Description / Service', xDesc + 8, y + 6.5, { width: colDesc - 16, align: 'left' });
        doc.text('Weight (kg)', xQty, y + 6.5, { width: colQty, align: 'center' });
        renderHeaderWithRupee('Rate (₹/kg)', xRate, y + 6.5, colRate, 'center');
        renderHeaderWithRupee('Total Wages (₹)', xAmt, y + 6.5, colAmt - 8, 'right');

        y += thH;

        // Row 1
        const rowH = 26;
        doc.rect(xSNo, y, colSNo, rowH).stroke();
        doc.rect(xDesc, y, colDesc, rowH).stroke();
        doc.rect(xQty, y, colQty, rowH).stroke();
        doc.rect(xRate, y, colRate, rowH).stroke();
        doc.rect(xAmt, y, colAmt, rowH).stroke();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text('1', xSNo, y + 8, { width: colSNo, align: 'center' });
        doc.text(data.workType || 'Peeling / Seafood Processing', xDesc + 8, y + 8, { width: colDesc - 16, align: 'left' });
        doc.text(`${data.quantity || 0} kg`, xQty, y + 8, { width: colQty, align: 'center' });

        renderAmount(data.price, xRate, y + 8, colRate - 8, 'right', 9, false, textDark);
        renderAmount(data.totalAmount, xAmt, y + 8, colAmt - 8, 'right', 9.5, true, textDark);

        y += rowH;

        // Spacer rows
        const emptyRowH = 22;
        for (let i = 0; i < 2; i++) {
          doc.rect(xSNo, y, colSNo, emptyRowH).stroke();
          doc.rect(xDesc, y, colDesc, emptyRowH).stroke();
          doc.rect(xQty, y, colQty, emptyRowH).stroke();
          doc.rect(xRate, y, colRate, emptyRowH).stroke();
          doc.rect(xAmt, y, colAmt, emptyRowH).stroke();
          y += emptyRowH;
        }

        // Total Row
        const totH = 26;
        doc.rect(L, y, W - colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);
        doc.rect(xAmt, y, colAmt, totH).fillAndStroke('#e8f1f8', borderBlue);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
        doc.text('TOTAL WAGE AMOUNT:', L, y + 7.5, { width: W - colAmt - 12, align: 'right' });

        renderAmount(data.totalAmount, xAmt, y + 6.5, colAmt - 8, 'right', 11, true, '#000000');

        y += totH;

        // Words row
        const wordsH = 20;
        doc.rect(L, y, W, wordsH).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('Amount in Words: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(numberToWords(data.totalAmount || 0), L + 88, y + 5.5);

        y += wordsH;
      } else if (type === 'statement') {
        const colSNo = 30;
        const colDate = 70;
        const colWork = 185;
        const colQty = 65;
        const colRate = 55;
        const colStatus = 55;
        const colTotal = W - colSNo - colDate - colWork - colQty - colRate - colStatus;

        const xSNo = L;
        const xDate = xSNo + colSNo;
        const xWork = xDate + colDate;
        const xQty = xWork + colWork;
        const xRate = xQty + colQty;
        const xStatus = xRate + colRate;
        const xTotal = xStatus + colStatus;

        // Header
        const thH = 20;
        doc.rect(xSNo, y, colSNo, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xDate, y, colDate, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xWork, y, colWork, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xQty, y, colQty, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xRate, y, colRate, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xStatus, y, colStatus, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.rect(xTotal, y, colTotal, thH).fillAndStroke('#f0f5fa', borderBlue);

        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('#', xSNo, y + 5.5, { width: colSNo, align: 'center' });
        doc.text('Date', xDate + 4, y + 5.5, { width: colDate });
        doc.text('Work Category & Shift', xWork + 4, y + 5.5, { width: colWork });
        doc.text('Weight', xQty, y + 5.5, { width: colQty, align: 'center' });
        doc.text('Rate', xRate, y + 5.5, { width: colRate, align: 'right' });
        doc.text('Status', xStatus, y + 5.5, { width: colStatus, align: 'center' });
        renderHeaderWithRupee('Total (₹)', xTotal, y + 5.5, colTotal - 4, 'right');

        y += thH;

        const entriesList = data.entries || [];
        entriesList.forEach((e, idx) => {
          const rowH = 18;
          doc.rect(xSNo, y, colSNo, rowH).stroke();
          doc.rect(xDate, y, colDate, rowH).stroke();
          doc.rect(xWork, y, colWork, rowH).stroke();
          doc.rect(xQty, y, colQty, rowH).stroke();
          doc.rect(xRate, y, colRate, rowH).stroke();
          doc.rect(xStatus, y, colStatus, rowH).stroke();
          doc.rect(xTotal, y, colTotal, rowH).stroke();

          doc.font('Helvetica').fontSize(7.8).fillColor(textDark);
          doc.text(String(idx + 1), xSNo, y + 4.5, { width: colSNo, align: 'center' });
          doc.text(formatDateStr(e.date), xDate + 4, y + 4.5, { width: colDate });
          doc.text(`${e.workType || 'Processing'} (${e.shift || 'Full Day'})`, xWork + 4, y + 4.5, { width: colWork });
          doc.font('Helvetica-Bold').text(`${e.quantity} kg`, xQty, y + 4.5, { width: colQty, align: 'center' });

          renderAmount(e.price, xRate, y + 4.5, colRate - 4, 'right', 7.8, false, textDark);

          doc.font('Helvetica-Bold').fontSize(7.8).fillColor(e.paymentStatus === 'Paid' ? '#16a34a' : '#d97706');
          doc.text(e.paymentStatus || 'Pending', xStatus, y + 4.5, { width: colStatus, align: 'center' });

          renderAmount(e.totalAmount, xTotal, y + 4.5, colTotal - 4, 'right', 8, true, primaryBlue);

          y += rowH;
        });

        // 3 Summary Rows (Total Earned, Total Paid, Pending Balance Due)
        const summaryH = 18;

        // Earned
        doc.rect(L, y, W - colTotal, summaryH).stroke();
        doc.rect(xTotal, y, colTotal, summaryH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('TOTAL EARNED:', L, y + 4.5, { width: W - colTotal - 12, align: 'right' });
        renderAmount(data.summary?.totalEarned, xTotal, y + 4.5, colTotal - 4, 'right', 9, true, primaryBlue);
        y += summaryH;

        // Paid
        doc.rect(L, y, W - colTotal, summaryH).stroke();
        doc.rect(xTotal, y, colTotal, summaryH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('TOTAL PAID:', L, y + 4.5, { width: W - colTotal - 12, align: 'right' });
        renderAmount(data.summary?.totalPaid, xTotal, y + 4.5, colTotal - 4, 'right', 9, true, '#16a34a');
        y += summaryH;

        // Balance Due
        doc.rect(L, y, W - colTotal, 22).fillAndStroke('#fef3c7', borderBlue);
        doc.rect(xTotal, y, colTotal, 22).fillAndStroke('#fef3c7', borderBlue);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#92400e');
        doc.text('PENDING BALANCE DUE:', L, y + 5.5, { width: W - colTotal - 12, align: 'right' });
        renderAmount(data.summary?.pendingBalance, xTotal, y + 5, colTotal - 4, 'right', 11, true, '#b45309');
        y += 22;
      }

      // 6. BANK PAYMENT DETAILS & SIGNATURE (Identical to Bill)
      const footerH = 52;
      const leftFooterW = Math.round(W * 0.58);
      const rightFooterW = W - leftFooterW;

      doc.rect(L, y, leftFooterW, footerH).fillAndStroke('#fafafa', borderBlue);
      doc.rect(L + leftFooterW, y, rightFooterW, footerH).fillAndStroke('#ffffff', borderBlue);

      // Bank Details Left Box
      doc.font('Helvetica-Bold').fontSize(7.6).fillColor(primaryBlue);
      doc.text('Bank Account Details:', L + 10, y + 6);

      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(textDark);
      doc.text('Bank: ', L + 10, y + 17, { continued: true });
      doc.font('Helvetica-Bold').text(settings.bankDetails?.bankName || 'KARUR VYSYA BANK');

      doc.font('Helvetica-Bold').text('A/C No: ', L + 10, y + 27, { continued: true });
      doc.font('Helvetica-Bold').text(settings.bankDetails?.accountNo || '4805135000002964');

      doc.font('Helvetica-Bold').text('IFSC: ', L + 10, y + 37, { continued: true });
      doc.font('Helvetica-Bold').text(`${settings.bankDetails?.ifsc || 'KVBL0004815'}   |   `, { continued: true });
      doc.font('Helvetica-Bold').text('Branch: ', { continued: true });
      doc.font('Helvetica-Bold').text(settings.bankDetails?.branch || 'Narasapur');

      // Signature Right Box
      const sigX = L + leftFooterW;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('For VIJAYA DURGA SEA FOODS', sigX, y + 7, { width: rightFooterW, align: 'center' });

      doc.lineWidth(0.5).strokeColor(textDark).moveTo(sigX + 25, y + 36).lineTo(sigX + rightFooterW - 25, y + 36).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryBlue);
      doc.text('Proprietor / Authorized Signature', sigX, y + 39, { width: rightFooterW, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateVoucherPDFBuffer };

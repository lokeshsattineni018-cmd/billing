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
        };
      }

      const resolvedVoucherNo = voucherNo || data.voucherNo || (type === 'ice' ? 'ICE-1' : type === 'worker' ? 'WB-1' : `STMT-${data.workerName || 'ALL'}`);

      const docTitle =
        type === 'ice'
          ? `Ice Bill ${resolvedVoucherNo}`
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
          Subject: type === 'statement' ? 'Worker Wage Statement' : type === 'ice' ? 'Ice Procurement Bill' : 'Worker Wage Bill',
        },
      });

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

      let y = 28;

      // 1. TOP BAR
      const row1H = 20;
      doc.lineWidth(lineW).strokeColor(borderBlue);
      doc.rect(L, y, W, row1H).stroke();

      const topTitle =
        type === 'ice'
          ? 'ICE BILL / EXPENSE VOUCHER'
          : type === 'worker'
          ? 'WORKER LABOR WAGE VOUCHER'
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
          `Prop: ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}   |   GSTIN: ${settings.gstin || '37KATPS1500Q1ZR'}`,
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
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text(labelNo, L + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#b12704');
      doc.text(` ${resolvedVoucherNo}`, L + 85, y + 4.5);

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
      doc.text('Date: ', L + halfW + 8, y + 5);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark);
      doc.text(`${formatDateStr(data.date || new Date())}`, L + halfW + 40, y + 5);

      y += row3H;

      // 4. PARTY / DETAILS ROW
      if (type === 'ice') {
        const row4H = 20;
        doc.rect(L, y, halfW, row4H).stroke();
        doc.rect(L + halfW, y, halfW, row4H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('From (Supplier): ', L + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.iceFrom || data.supplierName || 'Sri Rama Ice Plant', L + 85, y + 5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('To (Receiver): ', L + halfW + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(data.iceTo || 'Factory / Cold Storage', L + halfW + 75, y + 5);

        y += row4H;
      } else if (type === 'worker') {
        // Worker Name row
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

        // Shift & Status row
        const row5H = 20;
        doc.rect(L, y, halfW, row5H).stroke();
        doc.rect(L + halfW, y, halfW, row5H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Work Category & Shift: ', L + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(`${data.workType || 'Processing'} (${data.shift || 'Full Day'})`, L + 115, y + 5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Payment Status: ', L + halfW + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(data.paymentStatus === 'Paid' ? '#16a34a' : '#ea580c');
        doc.text(data.paymentStatus || 'Pending', L + halfW + 85, y + 5);

        y += row5H;
      } else if (type === 'statement') {
        // Worker Name row
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

        // Days & Weight row
        const row5H = 20;
        doc.rect(L, y, halfW, row5H).stroke();
        doc.rect(L + halfW, y, halfW, row5H).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Days Worked: ', L + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark);
        doc.text(`${data.summary?.daysWorkedCount || data.entries?.length || 0} days`, L + 80, y + 5);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('Total Weight Processed: ', L + halfW + 8, y + 5);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark);
        doc.text(`${data.summary?.totalKg || 0} kg`, L + halfW + 125, y + 5);

        y += row5H;
      }

      // 5. TABLE SECTION
      if (type === 'ice') {
        const colSNo = 40;
        const colDesc = 240;
        const colQty = 80;
        const colRate = 80;
        const colTotal = W - colSNo - colDesc - colQty - colRate;

        // Table Header
        const thH = 22;
        doc.rect(L, y, W, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);

        doc.text('S.No.', L, y + 6, { width: colSNo, align: 'center' });
        doc.text('Item Description / Particulars', L + colSNo + 8, y + 6, { width: colDesc });
        doc.text('Blocks', L + colSNo + colDesc, y + 6, { width: colQty, align: 'center' });
        doc.text('Rate (₹)', L + colSNo + colDesc + colQty, y + 6, { width: colRate, align: 'right' });
        doc.text('Amount (₹)', L + colSNo + colDesc + colQty + colRate - 8, y + 6, { width: colTotal, align: 'right' });

        y += thH;

        // Row 1
        const rowH = 24;
        doc.rect(L, y, W, rowH).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor(textDark);
        doc.text('1', L, y + 7, { width: colSNo, align: 'center' });
        doc.font('Helvetica-Bold').text('ICE', L + colSNo + 8, y + 7, { width: colDesc });
        doc.font('Helvetica-Bold').text(String(data.blocks || 0), L + colSNo + colDesc, y + 7, { width: colQty, align: 'center' });
        doc.font('Helvetica').text(Number(data.rate || 0).toFixed(2), L + colSNo + colDesc + colQty, y + 7, { width: colRate, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(primaryBlue).text(Number(data.totalAmount || 0).toFixed(2), L + colSNo + colDesc + colQty + colRate - 8, y + 7, { width: colTotal, align: 'right' });

        y += rowH;

        // Gap row
        const gapH = 45;
        doc.rect(L, y, W, gapH).stroke();
        y += gapH;

        // Total Row
        const totH = 24;
        doc.rect(L, y, W, totH).fillAndStroke('#f0f5fa', borderBlue);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
        doc.text('TOTAL AMOUNT', L, y + 7, { width: W - colTotal - 16, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
        doc.text(`₹${Number(data.totalAmount || 0).toFixed(2)}`, L + W - colTotal - 8, y + 6, { width: colTotal, align: 'right' });

        y += totH;

        // Words row
        const wordsH = 20;
        doc.rect(L, y, W, wordsH).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('Amount in Words: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark);
        doc.text(numberToWords(data.totalAmount || 0), L + 85, y + 5.5);

        y += wordsH;
      } else if (type === 'worker') {
        const colSNo = 40;
        const colDesc = 240;
        const colQty = 80;
        const colRate = 80;
        const colTotal = W - colSNo - colDesc - colQty - colRate;

        // Table Header
        const thH = 22;
        doc.rect(L, y, W, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);

        doc.text('S.No.', L, y + 6, { width: colSNo, align: 'center' });
        doc.text('Work Description / Service', L + colSNo + 8, y + 6, { width: colDesc });
        doc.text('Weight (kg)', L + colSNo + colDesc, y + 6, { width: colQty, align: 'center' });
        doc.text('Rate (₹/kg)', L + colSNo + colDesc + colQty, y + 6, { width: colRate, align: 'right' });
        doc.text('Total Wages (₹)', L + colSNo + colDesc + colQty + colRate - 8, y + 6, { width: colTotal, align: 'right' });

        y += thH;

        // Row 1
        const rowH = 24;
        doc.rect(L, y, W, rowH).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor(textDark);
        doc.text('1', L, y + 7, { width: colSNo, align: 'center' });
        doc.font('Helvetica-Bold').text(data.workType || 'Peeling / Seafood Processing', L + colSNo + 8, y + 7, { width: colDesc });
        doc.font('Helvetica-Bold').text(`${data.quantity || 0} kg`, L + colSNo + colDesc, y + 7, { width: colQty, align: 'center' });
        doc.font('Helvetica').text(Number(data.price || 0).toFixed(2), L + colSNo + colDesc + colQty, y + 7, { width: colRate, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(primaryBlue).text(Number(data.totalAmount || 0).toFixed(2), L + colSNo + colDesc + colQty + colRate - 8, y + 7, { width: colTotal, align: 'right' });

        y += rowH;

        // Gap row
        const gapH = 45;
        doc.rect(L, y, W, gapH).stroke();
        y += gapH;

        // Total Row
        const totH = 24;
        doc.rect(L, y, W, totH).fillAndStroke('#f0f5fa', borderBlue);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryBlue);
        doc.text('TOTAL WAGE AMOUNT', L, y + 7, { width: W - colTotal - 16, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
        doc.text(`₹${Number(data.totalAmount || 0).toFixed(2)}`, L + W - colTotal - 8, y + 6, { width: colTotal, align: 'right' });

        y += totH;

        // Words row
        const wordsH = 20;
        doc.rect(L, y, W, wordsH).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);
        doc.text('Amount in Words: ', L + 8, y + 5.5);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark);
        doc.text(numberToWords(data.totalAmount || 0), L + 85, y + 5.5);

        y += wordsH;
      } else if (type === 'statement') {
        const colSNo = 30;
        const colDate = 70;
        const colWork = 185;
        const colQty = 65;
        const colRate = 55;
        const colStatus = 55;
        const colTotal = W - colSNo - colDate - colWork - colQty - colRate - colStatus;

        // Header
        const thH = 20;
        doc.rect(L, y, W, thH).fillAndStroke('#f0f5fa', borderBlue);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryBlue);

        doc.text('#', L, y + 5.5, { width: colSNo, align: 'center' });
        doc.text('Date', L + colSNo + 4, y + 5.5, { width: colDate });
        doc.text('Work Category & Shift', L + colSNo + colDate + 4, y + 5.5, { width: colWork });
        doc.text('Weight', L + colSNo + colDate + colWork, y + 5.5, { width: colQty, align: 'center' });
        doc.text('Rate', L + colSNo + colDate + colWork + colQty, y + 5.5, { width: colRate, align: 'right' });
        doc.text('Status', L + colSNo + colDate + colWork + colQty + colRate, y + 5.5, { width: colStatus, align: 'center' });
        doc.text('Total (₹)', L + colSNo + colDate + colWork + colQty + colRate + colStatus - 4, y + 5.5, { width: colTotal, align: 'right' });

        y += thH;

        const entriesList = data.entries || [];
        entriesList.forEach((e, idx) => {
          const rowH = 18;
          doc.rect(L, y, W, rowH).stroke();
          doc.font('Helvetica').fontSize(7.8).fillColor(textDark);

          doc.text(String(idx + 1), L, y + 4.5, { width: colSNo, align: 'center' });
          doc.text(formatDateStr(e.date), L + colSNo + 4, y + 4.5, { width: colDate });
          doc.text(`${e.workType || 'Processing'} (${e.shift || 'Full Day'})`, L + colSNo + colDate + 4, y + 4.5, { width: colWork });
          doc.font('Helvetica-Bold').text(`${e.quantity} kg`, L + colSNo + colDate + colWork, y + 4.5, { width: colQty, align: 'center' });
          doc.font('Helvetica').text(`₹${Number(e.price).toFixed(2)}`, L + colSNo + colDate + colWork + colQty, y + 4.5, { width: colRate, align: 'right' });
          doc.font('Helvetica-Bold').fillColor(e.paymentStatus === 'Paid' ? '#16a34a' : '#ea580c').text(e.paymentStatus || 'Pending', L + colSNo + colDate + colWork + colQty + colRate, y + 4.5, { width: colStatus, align: 'center' });
          doc.font('Helvetica-Bold').fillColor(primaryBlue).text(Number(e.totalAmount).toFixed(2), L + colSNo + colDate + colWork + colQty + colRate + colStatus - 4, y + 4.5, { width: colTotal, align: 'right' });

          y += rowH;
        });

        // 3 Summary Rows (Total Earned, Total Paid, Pending Balance Due)
        const summaryH = 18;

        // Earned
        doc.rect(L, y, W, summaryH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('TOTAL EARNED:', L, y + 4.5, { width: W - colTotal - 16, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryBlue);
        doc.text(`₹${Number(data.summary?.totalEarned || 0).toFixed(2)}`, L + W - colTotal - 4, y + 4.5, { width: colTotal, align: 'right' });
        y += summaryH;

        // Paid
        doc.rect(L, y, W, summaryH).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
        doc.text('TOTAL PAID:', L, y + 4.5, { width: W - colTotal - 16, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a');
        doc.text(`₹${Number(data.summary?.totalPaid || 0).toFixed(2)}`, L + W - colTotal - 4, y + 4.5, { width: colTotal, align: 'right' });
        y += summaryH;

        // Balance Due
        doc.rect(L, y, W, 22).fillAndStroke('#fef3c7', borderBlue);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#92400e');
        doc.text('PENDING BALANCE DUE:', L, y + 5.5, { width: W - colTotal - 16, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#b45309');
        doc.text(`₹${Number(data.summary?.pendingBalance || 0).toFixed(2)}`, L + W - colTotal - 4, y + 5, { width: colTotal, align: 'right' });
        y += 22;
      }

      // 6. BANK PAYMENT DETAILS & SIGNATURE (Identical to Bill)
      const footerH = 50;
      doc.rect(L, y, W, footerH).strokeColor(borderBlue).lineWidth(lineW).stroke();
      doc.rect(L, y, halfW + 40, footerH).stroke();

      // Bank Details Left Box
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryBlue);
      doc.text('Bank Account Details:', L + 8, y + 6);
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(textDark);
      doc.text('BANK : KARUR VYSYA BANK', L + 8, y + 16);
      doc.text('A/c. NO : 4805135000002964', L + 8, y + 26);
      doc.text('IFSC : KVBL0004815   |   Branch : Narasapur', L + 8, y + 36);

      // Signature Right Box
      const sigX = L + halfW + 40;
      const sigW = W - (halfW + 40);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryBlue);
      doc.text('For VIJAYA DURGA SEA FOODS', sigX, y + 6, { width: sigW, align: 'center' });

      doc.lineWidth(0.5).strokeColor(textDark).moveTo(sigX + 25, y + 36).lineTo(sigX + sigW - 25, y + 36).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryBlue);
      doc.text('Proprietor / Authorized Signature', sigX, y + 38, { width: sigW, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateVoucherPDFBuffer };

const express = require('express');
const Bill = require('../models/Bill');
const Settings = require('../models/Settings');
const { protect, restrictTo } = require('../middleware/auth');
const { generatePeriodReportPDF } = require('../services/reportPdfService');
const { generateGSTR1PDF } = require('../services/gstPdfService');

const router = express.Router();

// Helper to calculate date range without mutating now
function getDateRange(range, customStart, customEnd) {
  const now = new Date();
  let start, end;

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (range === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'this_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start = new Date(now.getFullYear(), now.getMonth(), diff);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (range === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (range === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === 'custom' && customStart && customEnd) {
    start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default to this month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { start, end };
}

/**
 * GET /api/reports/sales
 * Comprehensive sales analytics report (Owner, Admin, Staff)
 */
router.get('/sales', protect, restrictTo('owner', 'admin', 'staff'), async (req, res) => {
  try {
    const { range = 'this_month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const matchQuery = {
      date: { $gte: start, $lte: end },
      isVoided: { $ne: true },
    };

    const [bills, topBuyers, itemsAgg, statusAgg] = await Promise.all([
      Bill.find(matchQuery).sort({ date: -1 }).lean(),
      Bill.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$companyName',
            totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            billCount: { $sum: 1 },
            phone: { $last: '$customerPhone' },
            gstin: { $last: '$companyGstin' },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
      ]),
      Bill.aggregate([
        { $match: matchQuery },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$items.particulars', '$particulars'] },
            totalQty: { $sum: { $ifNull: ['$items.quantity', '$quantity'] } },
            totalAmount: { $sum: { $ifNull: ['$items.amount', '$total'] } },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Bill.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$paymentStatus',
            totalAmount: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = bills.reduce((acc, b) => acc + (b.grandTotal || b.total || 0), 0);
    const totalTaxable = bills.reduce((acc, b) => acc + (b.taxableValue || b.total || 0), 0);
    const totalCGST = bills.reduce((acc, b) => acc + (b.cgstAmount || 0), 0);
    const totalSGST = bills.reduce((acc, b) => acc + (b.sgstAmount || 0), 0);
    const totalIGST = bills.reduce((acc, b) => acc + (b.igstAmount || 0), 0);
    const totalTax = totalCGST + totalSGST + totalIGST;

    const paidData = statusAgg.find((s) => s._id === 'Paid') || { totalAmount: 0, count: 0 };
    const pendingData = statusAgg.find((s) => s._id !== 'Paid') || { totalAmount: 0, count: 0 };

    const avgTicketSize = bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0;

    // Build WhatsApp summary text
    const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const rangeLabel = range.replace('_', ' ').toUpperCase();
    const dateStr = `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`;

    let waMessage = `VIJAYA DURGA AGENCIES\nSALES ANALYTICS REPORT (${rangeLabel})\n${dateStr}\n`;
    waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    waMessage += `Gross Revenue: ${fmt(totalRevenue)}\n`;
    waMessage += `Total Invoices: ${bills.length}\n`;
    waMessage += `Average Invoice: ${fmt(avgTicketSize)}\n`;
    waMessage += `Paid Collected: ${fmt(paidData.totalAmount)} (${paidData.count} bills)\n`;
    waMessage += `Pending Collection: ${fmt(pendingData.totalAmount)} (${pendingData.count} bills)\n`;
    if (totalTax > 0) {
      waMessage += `Total GST Tax: ${fmt(totalTax)}\n`;
    }
    waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    if (topBuyers.length > 0) {
      waMessage += `Top Buyers:\n`;
      topBuyers.slice(0, 5).forEach((tb, i) => {
        waMessage += `${i + 1}. ${tb._id} — ${fmt(tb.totalSales)} (${tb.billCount} bills)\n`;
      });
      waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    }
    waMessage += `Generated by Vijaya Durga Agencies Billing Suite`;

    res.json({
      summary: {
        totalRevenue,
        totalTaxable,
        totalTax,
        totalCGST,
        totalSGST,
        totalIGST,
        totalBills: bills.length,
        avgTicketSize,
        paidAmount: paidData.totalAmount,
        paidCount: paidData.count,
        pendingAmount: pendingData.totalAmount,
        pendingCount: pendingData.count,
      },
      bills: bills.map((b) => ({
        _id: b._id,
        billNumber: b.billNo,
        formattedBillNo: b.formattedBillNo || (b.financialYear ? `${b.financialYear}/${String(b.billNo).padStart(4, '0')}` : String(b.billNo)),
        date: b.date,
        companyName: b.companyName,
        customerPhone: b.customerPhone,
        grandTotal: b.grandTotal || b.total || 0,
        taxableValue: b.taxableValue || b.total || 0,
        cgstAmount: b.cgstAmount || 0,
        sgstAmount: b.sgstAmount || 0,
        igstAmount: b.igstAmount || 0,
        paymentStatus: b.paymentStatus || 'Pending',
        isVoided: b.isVoided || false,
        itemSummary: (b.items && b.items.length > 0)
          ? b.items.map((it) => `${it.particulars || ''} (${it.quantity || 0}kg)`).join(', ')
          : `${b.particulars || 'Item'} (${b.quantity || 0}kg)`,
      })),
      topBuyers,
      itemsAgg,
      dateRange: { start, end, label: rangeLabel },
      whatsappSummary: waMessage,
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/reports/outstanding
 * Customer Outstanding Summary & Pending Balances
 * (Owner, Admin, Staff)
 */
router.get('/outstanding', protect, restrictTo('owner', 'admin', 'staff'), async (req, res) => {
  try {
    const rawOutstanding = await Bill.aggregate([
      {
        $match: {
          paymentStatus: { $ne: 'Paid' },
          isVoided: { $ne: true },
          companyName: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] },
        },
      },
      {
        $project: {
          billNo: 1,
          formattedBillNo: 1,
          date: 1,
          companyName: 1,
          customerPhone: 1,
          companyGstin: 1,
          grandTotal: { $ifNull: ['$grandTotal', '$total'] },
          paidAmount: { $ifNull: ['$paidAmount', 0] },
          balanceDue: {
            $max: [0, { $subtract: [{ $ifNull: ['$grandTotal', '$total'] }, { $ifNull: ['$paidAmount', 0] }] }],
          },
          paymentStatus: 1,
        },
      },
      {
        $group: {
          _id: '$companyName',
          companyName: { $first: '$companyName' },
          customerPhone: { $last: '$customerPhone' },
          companyGstin: { $last: '$companyGstin' },
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          outstandingBalance: { $sum: '$balanceDue' },
          unpaidBillsCount: { $sum: 1 },
          oldestBillDate: { $min: '$date' },
          lastBillDate: { $max: '$date' },
          bills: {
            $push: {
              _id: '$_id',
              billNo: '$billNo',
              formattedBillNo: '$formattedBillNo',
              date: '$date',
              grandTotal: '$grandTotal',
              paidAmount: '$paidAmount',
              balanceDue: '$balanceDue',
              paymentStatus: '$paymentStatus',
            },
          },
        },
      },
      { $sort: { outstandingBalance: -1 } },
    ]);

    const totalOutstanding = rawOutstanding.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const totalUnpaidBills = rawOutstanding.reduce((sum, c) => sum + c.unpaidBillsCount, 0);

    const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const customers = rawOutstanding.map((c) => {
      const reminderMsg = `VIJAYA DURGA AGENCIES\nPAYMENT REMINDER\n\nDear ${c.companyName},\nThis is a gentle reminder regarding pending dues for your account.\n\n` +
        `💰 Outstanding Balance: ${fmt(c.outstandingBalance)}\n` +
        `🧾 Unpaid Invoices: ${c.unpaidBillsCount}\n\n` +
        `Bank Details for NEFT/RTGS/UPI:\n` +
        `• Bank: KARUR VYSYA BANK\n` +
        `• A/C Name: SATTINENI VENKATA DHANA LAXMI\n` +
        `• A/C No: 4805135000002964\n` +
        `• IFSC: KVBL0004815\n` +
        `• Branch: Narasapur\n\n` +
        `Kindly arrange the clearance at your earliest convenience. If already paid, please disregard this notice.\n\n` +
        `Thank you,\nVijaya Durga Agencies (Ph: 9441429745)`;

      return {
        ...c,
        reminderMessage: reminderMsg,
      };
    });

    res.json({
      summary: {
        totalOutstanding,
        totalCustomersWithDues: customers.length,
        totalUnpaidBills,
      },
      customers,
    });
  } catch (error) {
    console.error('Outstanding report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/reports/pdf
 * Download summary PDF report for any selected date range
 * (Owner and Admin)
 */
router.get('/pdf', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const { range = 'this_month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const matchQuery = {
      date: { $gte: start, $lte: end },
      isVoided: { $ne: true },
    };

    const [bills, topBuyers, itemsAgg, settingsDoc] = await Promise.all([
      Bill.find(matchQuery).sort({ date: -1 }).lean(),
      Bill.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$companyName',
            totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            billCount: { $sum: 1 },
            phone: { $last: '$customerPhone' },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
      ]),
      Bill.aggregate([
        { $match: matchQuery },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$items.particulars', '$particulars'] },
            totalQty: { $sum: { $ifNull: ['$items.quantity', '$quantity'] } },
            totalAmount: { $sum: { $ifNull: ['$items.amount', '$total'] } },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Settings.findOne().lean(),
    ]);

    const totalRevenue = bills.reduce((acc, b) => acc + (b.grandTotal || b.total || 0), 0);
    const totalTaxable = bills.reduce((acc, b) => acc + (b.taxableValue || b.total || 0), 0);
    const totalCGST = bills.reduce((acc, b) => acc + (b.cgstAmount || 0), 0);
    const totalSGST = bills.reduce((acc, b) => acc + (b.sgstAmount || 0), 0);
    const totalIGST = bills.reduce((acc, b) => acc + (b.igstAmount || 0), 0);
    const totalTax = totalCGST + totalSGST + totalIGST;

    const paidBills = bills.filter((b) => b.paymentStatus === 'Paid');
    const pendingBills = bills.filter((b) => b.paymentStatus !== 'Paid');
    const paidAmount = paidBills.reduce((acc, b) => acc + (b.grandTotal || b.total || 0), 0);
    const pendingAmount = pendingBills.reduce((acc, b) => acc + (b.grandTotal || b.total || 0), 0);
    const avgTicketSize = bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0;

    const summary = {
      totalRevenue,
      totalTaxable,
      totalTax,
      totalCGST,
      totalSGST,
      totalIGST,
      totalBills: bills.length,
      avgTicketSize,
      paidAmount,
      paidCount: paidBills.length,
      pendingAmount,
      pendingCount: pendingBills.length,
    };

    const rangeLabel = range.replace('_', ' ').toUpperCase();
    const pdfBuffer = await generatePeriodReportPDF({
      bills,
      summary,
      topBuyers,
      itemsAgg,
      dateRange: { start, end, label: rangeLabel },
      settings: settingsDoc || {},
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="financial_report_${range}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF report error:', error);
    res.status(500).json({ message: 'Failed to generate PDF report', error: error.message });
  }
});

/**
 * GET /api/reports/gst-pdf
 * Download official Government GSTR-1 Outward Supplies Summary PDF statement
 * (Owner and Admin)
 */
router.get('/gst-pdf', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const { range = 'this_month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const matchQuery = {
      date: { $gte: start, $lte: end },
    };

    const [bills, settingsDoc] = await Promise.all([
      Bill.find(matchQuery).sort({ date: 1 }).lean(),
      Settings.findOne().lean(),
    ]);

    const rangeLabel = range.replace('_', ' ').toUpperCase();
    const pdfBuffer = await generateGSTR1PDF({
      bills,
      dateRange: { start, end, label: rangeLabel },
      settings: settingsDoc || {},
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="gstr1_statement_${range}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('GSTR-1 PDF export error:', error);
    res.status(500).json({ message: 'Failed to generate GSTR-1 PDF statement', error: error.message });
  }
});

/**
 * GET /api/reports/gst-export
 * Export GSTR-1 compliant CSV (B2B, B2C, HSN Breakup)
 * (Owner and Admin)
 */
router.get('/gst-export', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const { range = 'this_month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const bills = await Bill.find({
      date: { $gte: start, $lte: end },
      isVoided: { $ne: true },
    }).sort({ date: 1 }).lean();

    const csvLines = [];
    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // SECTION 1: B2B INVOICES (Taxpayers with valid GSTIN)
    csvLines.push('"=== GSTR-1: B2B INVOICES (Table 4) ==="');
    csvLines.push([
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Invoice Number',
      'Invoice Date',
      'Invoice Value (₹)',
      'Place Of Supply',
      'Reverse Charge',
      'Applicable % of Tax Rate',
      'Invoice Type',
      'Rate (%)',
      'Taxable Value (₹)',
      'Integrated Tax (₹)',
      'Central Tax (₹)',
      'State/UT Tax (₹)',
      'Cess Amount (₹)',
    ].map(escape).join(','));

    const b2bBills = bills.filter((b) => b.companyGstin && b.companyGstin.trim().length >= 10);
    const b2cBills = bills.filter((b) => !b.companyGstin || b.companyGstin.trim().length < 10);

    b2bBills.forEach((b) => {
      const gTot = b.grandTotal || b.total || 0;
      const taxable = b.taxableValue || b.total || 0;
      const rate = b.cgstRate && b.sgstRate ? (parseFloat(b.cgstRate) || 0) + (parseFloat(b.sgstRate) || 0) : (parseFloat(b.igstRate) || 0);

      csvLines.push([
        b.companyGstin,
        b.companyName,
        b.formattedBillNo || b.billNo,
        fmtDate(b.date),
        gTot.toFixed(2),
        '37-Andhra Pradesh',
        'N',
        '',
        'Regular',
        rate,
        taxable.toFixed(2),
        (b.igstAmount || 0).toFixed(2),
        (b.cgstAmount || 0).toFixed(2),
        (b.sgstAmount || 0).toFixed(2),
        '0.00',
      ].map(escape).join(','));
    });

    csvLines.push('');
    csvLines.push('');

    // SECTION 2: B2C SMALL INVOICES (Table 7)
    csvLines.push('"=== GSTR-1: B2C SMALL INVOICES (Table 7) ==="');
    csvLines.push([
      'Type',
      'Place Of Supply',
      'Applicable % of Tax Rate',
      'Rate (%)',
      'Taxable Value (₹)',
      'Cess Amount (₹)',
      'Invoice Count',
    ].map(escape).join(','));

    const b2cTaxable = b2cBills.reduce((acc, b) => acc + (b.taxableValue || b.total || 0), 0);
    if (b2cBills.length > 0) {
      csvLines.push([
        'OE',
        '37-Andhra Pradesh',
        '',
        '0',
        b2cTaxable.toFixed(2),
        '0.00',
        b2cBills.length,
      ].map(escape).join(','));
    }

    csvLines.push('');
    csvLines.push('');

    // SECTION 3: HSN-WISE SUMMARY (Table 12)
    csvLines.push('"=== GSTR-1: HSN-WISE SUMMARY OF OUTWARD SUPPLIES (Table 12) ==="');
    csvLines.push([
      'HSN',
      'Description',
      'UQC',
      'Total Quantity',
      'Total Value (₹)',
      'Taxable Value (₹)',
      'Integrated Tax (₹)',
      'Central Tax (₹)',
      'State/UT Tax (₹)',
      'Cess (₹)',
    ].map(escape).join(','));

    // Aggregate by HSN
    const hsnMap = new Map();
    bills.forEach((b) => {
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
            igst: 0,
            cgst: 0,
            sgst: 0,
          };
          prev.qty += it.quantity || 0;
          prev.totalVal += it.amount || 0;
          prev.taxableVal += it.amount || 0;
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
          igst: 0,
          cgst: 0,
          sgst: 0,
        };
        prev.qty += b.quantity || 0;
        prev.totalVal += b.grandTotal || b.total || 0;
        prev.taxableVal += b.taxableValue || b.total || 0;
        prev.igst += b.igstAmount || 0;
        prev.cgst += b.cgstAmount || 0;
        prev.sgst += b.sgstAmount || 0;
        hsnMap.set(code, prev);
      }
    });

    hsnMap.forEach((val) => {
      csvLines.push([
        val.hsn,
        val.desc,
        val.uqc,
        val.qty.toFixed(2),
        val.totalVal.toFixed(2),
        val.taxableVal.toFixed(2),
        val.igst.toFixed(2),
        val.cgst.toFixed(2),
        val.sgst.toFixed(2),
        '0.00',
      ].map(escape).join(','));
    });

    const csvContent = '\ufeff' + csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gstr1_export_${range}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('GST export error:', error);
    res.status(500).json({ message: 'Failed to generate GST export', error: error.message });
  }
});

module.exports = router;

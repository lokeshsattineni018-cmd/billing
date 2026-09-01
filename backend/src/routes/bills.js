const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const Settings = require('../models/Settings');
const Customer = require('../models/Customer');
const { getNextSequence } = require('../models/Counter');
const { protect, restrictTo } = require('../middleware/auth');
const { billCreateLimiter, escapeRegex } = require('../middleware/security');
const { logActivity } = require('../utils/activityLogger');
const { generateBillPDFBuffer } = require('../services/pdfService');

const router = express.Router();

/**
 * GET /api/bills/ledger
 * Customer Ledger with total invoiced, paid, and outstanding balances
 * (Owner and Admin only — protects confidential customer financial ledgers)
 */
router.get('/ledger', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const customers = await Bill.aggregate([
      {
        $match: {
          companyName: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] },
          isVoided: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$companyName',
          companyName: { $first: '$companyName' },
          companyGstin: { $last: '$companyGstin' },
          customerPhone: { $last: '$customerPhone' },
          totalInvoiced: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, { $ifNull: ['$grandTotal', '$total'] }, 0],
            },
          },
          outstandingBalance: {
            $sum: {
              $cond: [{ $ne: ['$paymentStatus', 'Paid'] }, { $ifNull: ['$grandTotal', '$total'] }, 0],
            },
          },
          totalBills: { $sum: 1 },
          unpaidBillsCount: {
            $sum: {
              $cond: [{ $ne: ['$paymentStatus', 'Paid'] }, 1, 0],
            },
          },
          lastBillDate: { $max: '$date' },
        },
      },
      { $sort: { outstandingBalance: -1, totalInvoiced: -1 } },
    ]);

    const totalReceivables = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalInvoiced, 0);
    const totalCollected = customers.reduce((sum, c) => sum + c.totalPaid, 0);

    res.json({
      customers,
      summary: {
        totalReceivables,
        totalRevenue,
        totalCollected,
        totalCustomers: customers.length,
      },
    });
  } catch (error) {
    console.error('Ledger error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/bills
 * List bills with pagination, search, and date filtering
 */
router.get('/', protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      const escaped = escapeRegex(search);
      const billNoSearch = parseInt(search);

      if (!isNaN(billNoSearch) && String(billNoSearch) === search) {
        filter.$or = [
          { billNo: billNoSearch },
          { companyName: { $regex: escaped, $options: 'i' } },
        ];
      } else {
        filter.companyName = { $regex: escaped, $options: 'i' };
      }
    }

    if (req.query.customer && typeof req.query.customer === 'string') {
      filter.companyName = req.query.customer.trim();
    }

    if (req.query.status && ['Pending', 'Paid'].includes(req.query.status)) {
      filter.paymentStatus = req.query.status;
    }

    if (req.query.voided === 'true') {
      filter.isVoided = true;
    } else if (req.query.voided === 'false') {
      filter.isVoided = { $ne: true };
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from && !isNaN(new Date(req.query.from).getTime())) {
        filter.date.$gte = new Date(req.query.from);
      }
      if (req.query.to && !isNaN(new Date(req.query.to).getTime())) {
        const toDate = new Date(req.query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }

    // Export all if limit === -1 and user is owner/admin
    const isExport = (req.query.limit === '-1' || req.query.all === 'true') && ['owner', 'admin'].includes(req.user.role);

    const [bills, total] = await Promise.all([
      isExport
        ? Bill.find(filter).populate('createdBy', 'name').populate('voidedBy', 'name').sort({ billNo: -1 }).lean()
        : Bill.find(filter).populate('createdBy', 'name').populate('voidedBy', 'name').sort({ billNo: -1 }).skip(skip).limit(limit).lean(),
      Bill.countDocuments(filter),
    ]);

    res.json({
      bills,
      pagination: {
        page: isExport ? 1 : page,
        limit: isExport ? total : limit,
        total,
        pages: isExport ? 1 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/bills/customers
 * High-speed indexed customer list for quick autocomplete
 */
router.get('/customers/list', protect, async (req, res) => {
  try {
    const customers = await Bill.aggregate([
      {
        $match: {
          companyName: { $exists: true, $ne: '', $nin: ['null', 'undefined'] },
          isVoided: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$companyName',
          companyName: { $first: '$companyName' },
          customerPhone: { $last: '$customerPhone' },
        },
      },
      { $sort: { companyName: 1 } },
      { $limit: 250 },
    ]);
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bills/export/csv
 * Export filtered bills to Excel-compatible CSV format (Admin only)
 */
router.get('/export/csv', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus, isVoided } = req.query;
    const filter = {};

    if (isVoided === 'true') filter.isVoided = true;
    else if (isVoided === 'false' || isVoided === undefined) filter.isVoided = { $ne: true };

    if (search) {
      const sanitized = escapeRegex(search.trim());
      const numSearch = parseInt(search.trim(), 10);
      filter.$or = [
        { companyName: { $regex: sanitized, $options: 'i' } },
        { customerPhone: { $regex: sanitized, $options: 'i' } },
        ...(isNaN(numSearch) ? [] : [{ billNo: numSearch }]),
      ];
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        dFrom.setHours(0, 0, 0, 0);
        filter.date.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        filter.date.$lte = dTo;
      }
    }

    if (paymentStatus && ['Pending', 'Paid'].includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    const bills = await Bill.find(filter).sort({ billNo: -1 }).lean();

    // Generate CSV Header
    const headers = [
      'Invoice No',
      'Date',
      'Customer Name',
      'GSTIN',
      'Phone Number',
      'Particulars',
      'Quantity (KG)',
      'Rate (INR)',
      'Taxable Value',
      'CGST (INR)',
      'SGST (INR)',
      'IGST (INR)',
      'Grand Total (INR)',
      'Payment Status',
      'Void Status',
    ];

    const rows = bills.map((b) => {
      const dStr = new Date(b.date).toLocaleDateString('en-IN');
      const particulars = b.items?.map((it) => it.particulars).join('; ') || b.particulars || '';
      const qty = b.items?.reduce((s, it) => s + (it.quantity || 0), 0) || b.quantity || 0;
      const rate = b.items?.[0]?.rate || b.rate || 0;
      const taxable = b.taxableValue || b.total || 0;
      const grandTotal = b.grandTotal || b.total || 0;

      return [
        `"${b.billNo}"`,
        `"${dStr}"`,
        `"${(b.companyName || '').replace(/"/g, '""')}"`,
        `"${b.companyGstin || ''}"`,
        `"${b.customerPhone || ''}"`,
        `"${particulars.replace(/"/g, '""')}"`,
        qty,
        rate,
        taxable.toFixed(2),
        (b.cgstAmount || 0).toFixed(2),
        (b.sgstAmount || 0).toFixed(2),
        (b.igstAmount || 0).toFixed(2),
        grandTotal.toFixed(2),
        `"${b.paymentStatus || 'Pending'}"`,
        `"${b.isVoided ? 'VOIDED' : 'VALID'}"`,
      ].join(',');
    });

    // UTF-8 BOM for proper Excel rendering of special characters
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    await logActivity(req, 'EXPORT_CSV', 'BILLS', { count: bills.length });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Vijaya-Durga-Bills-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('CSV Export Error:', error);
    res.status(500).json({ message: 'Failed to export CSV', error: error.message });
  }
});

/**
 * GET /api/bills/export/tally
 * Export bills in standard Tally Prime / Tally.ERP 9 XML format (Admin only)
 */
router.get('/export/tally', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = { isVoided: { $ne: true } };

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        filter.date.$lte = dTo;
      }
    }

    const bills = await Bill.find(filter).sort({ billNo: 1 }).lean();

    // Helper for Tally XML Date format: YYYYMMDD
    const tallyDate = (d) => {
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<ENVELOPE>\n`;
    xml += `  <HEADER>\n`;
    xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
    xml += `  </HEADER>\n`;
    xml += `  <BODY>\n`;
    xml += `    <IMPORTDATA>\n`;
    xml += `      <REQUESTDESC>\n`;
    xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
    xml += `        <STATICVARIABLES>\n`;
    xml += `          <SVCURRENTCOMPANY>VIJAYA DURGA AGENCIES</SVCURRENTCOMPANY>\n`;
    xml += `        </STATICVARIABLES>\n`;
    xml += `      </REQUESTDESC>\n`;
    xml += `      <REQUESTDATA>\n`;

    for (const b of bills) {
      const vDate = tallyDate(b.date);
      const totalAmount = (b.grandTotal || b.total || 0).toFixed(2);
      const taxable = (b.taxableValue || b.total || 0).toFixed(2);
      const customerName = (b.companyName || 'Cash Sales').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const narration = `Tax Invoice #${b.billNo} - Seafood Supply GSTIN: ${b.companyGstin || ''}`;

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
      xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
      xml += `            <DATE>${vDate}</DATE>\n`;
      xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
      xml += `            <VOUCHERNUMBER>${b.billNo}</VOUCHERNUMBER>\n`;
      xml += `            <PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>\n`;
      xml += `            <NARRATION>${narration}</NARRATION>\n`;

      // Debit Entry (Party Ledger)
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${customerName}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>-${totalAmount}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;

      // Credit Entry (Sales Account)
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Sales Account</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${taxable}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;

      // CGST Entry if applicable
      if (b.cgstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>CGST Output</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${b.cgstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }

      // SGST Entry if applicable
      if (b.sgstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>SGST Output</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${b.sgstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }

      // IGST Entry if applicable
      if (b.igstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>IGST Output</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${b.igstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }

      xml += `          </VOUCHER>\n`;
      xml += `        </TALLYMESSAGE>\n`;
    }

    xml += `      </REQUESTDATA>\n`;
    xml += `    </IMPORTDATA>\n`;
    xml += `  </BODY>\n`;
    xml += `</ENVELOPE>\n`;

    await logActivity(req, 'EXPORT_TALLY', 'TALLY_XML', { count: bills.length });

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Vijaya-Durga-Tally-Sales-${Date.now()}.xml"`);
    res.status(200).send(xml);
  } catch (error) {
    console.error('Tally Export Error:', error);
    res.status(500).json({ message: 'Failed to export Tally XML', error: error.message });
  }
});

/**
 * GET /api/bills/:id/reminder
 * Build formatted WhatsApp & SMS payment reminder messages (Admin only)
 */
router.get('/:id/reminder', protect, restrictTo('admin'), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const settings = await Settings.findOne() || {};
    const amount = Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const billDate = new Date(bill.date).toLocaleDateString('en-IN');
    const cleanPhone = (bill.customerPhone || '').replace(/\D/g, '').slice(-10);

    // Formatted WhatsApp Reminder Message
    let waMsg = `*VIJAYA DURGA AGENCIES*\n`;
    waMsg += `*Payment Reminder / చెల్లింపు రిమైండర్*\n`;
    waMsg += `━━━━━━━━━━━━━━━━━━━\n`;
    waMsg += `Dear *${bill.companyName}*,\n`;
    waMsg += `This is a reminder regarding your pending seafood invoice:\n\n`;
    waMsg += `*Invoice No:* #${bill.billNo}\n`;
    waMsg += `*Invoice Date:* ${billDate}\n`;
    waMsg += `*Pending Amount:* Rs. ${amount}\n`;
    waMsg += `━━━━━━━━━━━━━━━━━━━\n`;
    waMsg += `*Bank Account Details for Payment:*\n`;
    waMsg += `• *Bank:* ${settings.bankName || 'KARUR VYSYA BANK'}\n`;
    waMsg += `• *Account Name:* ${settings.legalName || 'SATTINENI VENKATA DHANA LAXMI'}\n`;
    waMsg += `• *A/c Number:* ${settings.accountNo || '4805135000002964'}\n`;
    waMsg += `• *IFSC Code:* ${settings.ifscCode || 'KVBL0004815'}\n`;
    waMsg += `• *Branch:* ${settings.branch || 'Narasapur'}\n`;
    waMsg += `━━━━━━━━━━━━━━━━━━━\n`;
    waMsg += `Kindly clear the payment at your earliest convenience.\n`;
    waMsg += `Thank you for your continuous business.\n`;
    waMsg += `_Vijaya Durga Agencies • Ph: ${settings.phone || '9441429745'}_`;

    // Formatted Compact SMS Message
    const smsMsg = `VIJAYA DURGA AGENCIES: Dear ${bill.companyName}, gentle reminder for pending Invoice #${bill.billNo} dated ${billDate} for Rs. ${amount}. Bank: KVB A/c 4805135000002964, IFSC: KVBL0004815. Please clear payment. Ph: 9441429745`;

    await logActivity(req, 'SEND_REMINDER', String(bill.billNo), {
      customer: bill.companyName,
      amount: bill.grandTotal || bill.total,
    });

    res.json({
      billNo: bill.billNo,
      companyName: bill.companyName,
      customerPhone: cleanPhone,
      amount: bill.grandTotal || bill.total,
      whatsappMessage: waMsg,
      smsMessage: smsMsg,
    });
  } catch (error) {
    console.error('Reminder Error:', error);
    res.status(500).json({ message: 'Failed to generate reminder', error: error.message });
  }
});

/**
 * POST /api/bills/:id/duplicate
 * Clone/Duplicate an invoice (Admin only)
 */
router.post('/:id/duplicate', protect, restrictTo('admin'), async (req, res) => {
  try {
    const sourceBill = await Bill.findById(req.params.id);
    if (!sourceBill) {
      return res.status(404).json({ message: 'Source invoice not found' });
    }

    const billNo = await getNextSequence('billNo');

    const duplicate = await Bill.create({
      billNo,
      date: new Date(),
      companyName: sourceBill.companyName,
      companyGstin: sourceBill.companyGstin,
      customerPhone: sourceBill.customerPhone,
      particulars: sourceBill.particulars,
      hsn: sourceBill.hsn,
      quantity: sourceBill.quantity,
      rate: sourceBill.rate,
      items: sourceBill.items,
      taxableValue: sourceBill.taxableValue,
      cgstRate: sourceBill.cgstRate,
      cgstAmount: sourceBill.cgstAmount,
      sgstRate: sourceBill.sgstRate,
      sgstAmount: sourceBill.sgstAmount,
      igstRate: sourceBill.igstRate,
      igstAmount: sourceBill.igstAmount,
      total: sourceBill.total,
      grandTotal: sourceBill.grandTotal,
      paymentStatus: 'Pending',
      isVoided: false,
      createdBy: req.user._id,
    });

    await logActivity(req, 'CREATE_BILL', String(billNo), {
      duplicatedFrom: sourceBill.billNo,
      customer: sourceBill.companyName,
      amount: duplicate.grandTotal || duplicate.total,
    });

    const populated = await Bill.findById(duplicate._id).populate('createdBy', 'name');
    res.status(201).json({
      message: `Invoice #${sourceBill.billNo} duplicated successfully as Invoice #${billNo}`,
      bill: populated,
    });
  } catch (error) {
    console.error('Duplicate Bill Error:', error);
    res.status(500).json({ message: 'Failed to duplicate bill', error: error.message });
  }
});

/**
 * Helper to locate bill securely by shareToken (or backward compatible ObjectId)
 */
async function findBillByPublicToken(token) {
  if (!token || typeof token !== 'string') return null;

  // Strict check: Block any integer/sequential ID enumeration attempts (e.g., '1', '2', '3')
  if (/^\d+$/.test(token)) {
    return null;
  }

  // 1. Primary secure lookup: Match 128-bit cryptographic shareToken
  let bill = await Bill.findOne({ shareToken: token });
  if (bill) return bill;

  // 2. Backward compatibility fallback for legacy bills saved before shareToken migration
  if (mongoose.Types.ObjectId.isValid(token)) {
    bill = await Bill.findById(token);
    if (bill && !bill.shareToken) {
      bill.shareToken = crypto.randomBytes(16).toString('hex');
      await bill.save();
    }
  }

  return bill;
}

/**
 * GET /api/bills/public/:token
 * Public endpoint for customers to view their invoice via unguessable share link
 * Prevents IDOR/enumeration attacks by using 128-bit random tokens
 */
router.get('/public/:token', async (req, res) => {
  try {
    const bill = await findBillByPublicToken(req.params.token);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found or invalid access token' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/bills/public/:token/pdf
 * Public PDF streaming endpoint for customer viewing with valid share token
 */
router.get('/public/:token/pdf', async (req, res) => {
  try {
    const bill = await findBillByPublicToken(req.params.token);
    if (!bill) {
      return res.status(404).send('Invoice not found or invalid access token');
    }

    const pdfBuffer = await generateBillPDFBuffer(bill);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${bill.billNo}${bill.isVoided ? '-VOIDED' : ''}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Public PDF Route Error:', error);
    if (!res.headersSent) {
      res.status(500).send('PDF generation failed: ' + error.message);
    }
  }
});

/**
 * GET /api/bills/:id
 * Get a single bill by ID
 */
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const bill = await Bill.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('voidedBy', 'name');
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Helper to calculate verified totals server-side
 */
function calculateVerifiedBillTotals(items, cgstAmount = 0, sgstAmount = 0, igstAmount = 0) {
  const processedItems = items.map((it, idx) => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.rate) || 0;
    if (q <= 0 || r <= 0) {
      throw new Error(`Item #${idx + 1} (${it.particulars || 'Item'}) must have quantity > 0 and rate > 0`);
    }
    const itemAmt = Math.round(q * r * 100) / 100;
    return {
      sno: idx + 1,
      particulars: it.particulars?.trim() || 'Fresh Seafood / Prawns Supply',
      hsn: it.hsn?.trim() || '0306',
      quantity: q,
      rate: r,
      taxRate: it.taxRate || '',
      amount: itemAmt,
    };
  });

  const subtotal = Math.round(processedItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const numCgst = Math.round((parseFloat(cgstAmount) || 0) * 100) / 100;
  const numSgst = Math.round((parseFloat(sgstAmount) || 0) * 100) / 100;
  const numIgst = Math.round((parseFloat(igstAmount) || 0) * 100) / 100;

  const grandTotal = Math.round((subtotal + numCgst + numSgst + numIgst) * 100) / 100;

  return {
    processedItems,
    subtotal,
    cgstAmount: numCgst,
    sgstAmount: numSgst,
    igstAmount: numIgst,
    grandTotal,
  };
}

/**
 * POST /api/bills
 * Create a new invoice with rate limiting, server-side calculation, and route validation
 */
router.post('/', protect, billCreateLimiter, [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('date').optional().isISO8601().withMessage('Invoice date must be a valid date format'),
  body('items').custom((value, { req }) => {
    if (value && Array.isArray(value)) {
      if (value.length === 0) throw new Error('At least one item is required');
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          throw new Error(`Item #${i + 1} must have Quantity > 0`);
        }
        if (!item.rate || parseFloat(item.rate) <= 0) {
          throw new Error(`Item #${i + 1} must have Price/Rate > 0`);
        }
      }
    } else {
      if (!req.body.quantity || parseFloat(req.body.quantity) <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      if (!req.body.rate || parseFloat(req.body.rate) <= 0) {
        throw new Error('Rate must be greater than 0');
      }
    }
    return true;
  }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    let {
      companyName,
      companyGstin,
      customerPhone,
      date,
      items,
      particulars,
      hsn,
      quantity,
      rate,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      total,
      grandTotal,
      paymentStatus,
    } = req.body;

    // Fetch GSTIN dynamically from Settings
    let settings = await Settings.findOne();
    if (!settings || !settings.gstin) {
      return res.status(400).json({
        message: 'Business GSTIN is not configured in Settings. Please set your business GSTIN in Settings first.',
      });
    }

    const gstin = (companyGstin?.trim() || settings.gstin).trim();

    if (!items || !Array.isArray(items) || items.length === 0) {
      items = [{
        sno: 1,
        particulars: particulars || 'Fresh Seafood / Prawns Supply',
        hsn: hsn || '0306',
        quantity: parseFloat(quantity) || 0,
        rate: parseFloat(rate) || 0,
        taxRate: '',
        amount: 0,
      }];
    }

    let calculated;
    try {
      calculated = calculateVerifiedBillTotals(items, cgstAmount, sgstAmount, igstAmount);
    } catch (calcErr) {
      return res.status(400).json({ message: calcErr.message });
    }

    const clientProvidedTotal = parseFloat(total) || parseFloat(grandTotal) || 0;
    const matchesSubtotal = Math.abs(clientProvidedTotal - calculated.subtotal) <= 1.00;
    const matchesGrandTotal = Math.abs(clientProvidedTotal - calculated.grandTotal) <= 1.00;

    if (clientProvidedTotal > 0 && !matchesSubtotal && !matchesGrandTotal) {
      return res.status(400).json({
        message: `Calculated total (₹${calculated.subtotal}) does not match client total (₹${clientProvidedTotal}). Please check item rates and weights.`,
      });
    }

    const billNo = await getNextSequence('billNo');

    const bill = await Bill.create({
      billNo,
      date: date ? new Date(date) : new Date(),
      companyName: companyName.trim(),
      companyGstin: gstin,
      customerPhone: customerPhone ? customerPhone.replace(/\D/g, '').slice(0, 10) : '',
      particulars: calculated.processedItems[0]?.particulars || 'Fresh Seafood / Prawns Supply',
      hsn: calculated.processedItems[0]?.hsn || '0306',
      quantity: calculated.processedItems[0]?.quantity,
      rate: calculated.processedItems[0]?.rate,
      items: calculated.processedItems,
      taxableValue: taxableValue || calculated.subtotal,
      cgstRate: cgstRate || '',
      cgstAmount: calculated.cgstAmount,
      sgstRate: sgstRate || '',
      sgstAmount: calculated.sgstAmount,
      igstRate: igstRate || '',
      igstAmount: calculated.igstAmount,
      total: calculated.subtotal,
      grandTotal: (calculated.cgstAmount > 0 || calculated.sgstAmount > 0 || calculated.igstAmount > 0) ? calculated.grandTotal : calculated.subtotal,
      paymentStatus: paymentStatus === 'Paid' ? 'Paid' : 'Pending',
      isVoided: false,
      createdBy: req.user._id,
    });

    // Check customer credit limit
    let creditWarning = null;
    try {
      const customerDoc = await Customer.findOne({
        name: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') },
      }).lean();

      if (customerDoc && customerDoc.creditLimit > 0) {
        const pendingTotal = await Bill.aggregate([
          {
            $match: {
              companyName: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') },
              paymentStatus: { $ne: 'Paid' },
              isVoided: { $ne: true },
            },
          },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$grandTotal', '$total'] } } } },
        ]);
        const currentUnpaid = pendingTotal[0]?.total || 0;
        const totalAfterBill = currentUnpaid + (bill.grandTotal || bill.total);
        if (totalAfterBill > customerDoc.creditLimit) {
          creditWarning = `Warning: Customer ${companyName} has unpaid balance of ₹${currentUnpaid.toFixed(2)}. This bill (₹${(bill.grandTotal || bill.total).toFixed(2)}) exceeds their credit limit of ₹${customerDoc.creditLimit.toFixed(2)}.`;
        }
      }
    } catch (cErr) {
      console.warn('Credit limit check error:', cErr.message);
    }

    await logActivity(req, 'CREATE_BILL', String(bill.billNo), {
      customer: bill.companyName,
      amount: bill.grandTotal || bill.total,
      billNo: bill.billNo,
    });

    const populatedBill = await Bill.findById(bill._id).populate('createdBy', 'name');
    res.status(201).json({
      ...populatedBill.toObject(),
      creditWarning,
    });
  } catch (error) {
    console.error('Create Bill Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/bills/:id
 * Edit existing invoice (Same-day correction with IDOR protection)
 */
router.put('/:id', protect, [
  body('companyName').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (bill.isVoided) {
      return res.status(400).json({ message: 'Cannot edit a voided invoice.' });
    }

    // IDOR & Authorization check: only admin/owner or original creator on the same calendar day
    const isOwnerOrAdmin = ['owner', 'admin'].includes(req.user.role);
    const isCreator = bill.createdBy?.toString() === req.user._id?.toString();
    const billDate = new Date(bill.createdAt || bill.date);
    const isSameDay = billDate.toDateString() === new Date().toDateString();

    if (!isOwnerOrAdmin && (!isCreator || !isSameDay)) {
      return res.status(403).json({
        message: 'You can only edit your own invoices on the same day they were created.',
      });
    }

    const {
      companyName,
      customerPhone,
      date,
      items,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      paymentStatus,
    } = req.body;

    if (companyName) bill.companyName = companyName.trim();
    if (customerPhone !== undefined) bill.customerPhone = customerPhone.replace(/\D/g, '').slice(0, 10);
    if (date && isOwnerOrAdmin) bill.date = new Date(date);
    if (paymentStatus && isOwnerOrAdmin) bill.paymentStatus = paymentStatus;

    if (items && Array.isArray(items) && items.length > 0) {
      const calculated = calculateVerifiedBillTotals(
        items,
        cgstAmount !== undefined ? cgstAmount : bill.cgstAmount,
        sgstAmount !== undefined ? sgstAmount : bill.sgstAmount,
        igstAmount !== undefined ? igstAmount : bill.igstAmount
      );

      bill.items = calculated.processedItems;
      bill.particulars = calculated.processedItems[0]?.particulars;
      bill.hsn = calculated.processedItems[0]?.hsn;
      bill.quantity = calculated.processedItems[0]?.quantity;
      bill.rate = calculated.processedItems[0]?.rate;
      bill.total = calculated.subtotal;
      bill.taxableValue = calculated.subtotal;
      bill.cgstRate = cgstRate !== undefined ? cgstRate : bill.cgstRate;
      bill.cgstAmount = calculated.cgstAmount;
      bill.sgstRate = sgstRate !== undefined ? sgstRate : bill.sgstRate;
      bill.sgstAmount = calculated.sgstAmount;
      bill.igstRate = igstRate !== undefined ? igstRate : bill.igstRate;
      bill.igstAmount = calculated.igstAmount;
      bill.grandTotal = (calculated.cgstAmount > 0 || calculated.sgstAmount > 0 || calculated.igstAmount > 0)
        ? calculated.grandTotal
        : calculated.subtotal;
    }

    await bill.save();
    await logActivity(req, 'EDIT_BILL', String(bill.billNo), {
      customer: bill.companyName,
      amount: bill.grandTotal || bill.total,
    });

    const updated = await Bill.findById(bill._id).populate('createdBy', 'name');
    res.json(updated);
  } catch (error) {
    console.error('Update Bill Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/bills/:id/void
 * Void an invoice (Admin only)
 */
router.patch('/:id/void', protect, restrictTo('admin'), [
  body('reason').optional().trim(),
], async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (bill.isVoided) {
      return res.status(400).json({ message: 'Invoice is already voided.' });
    }

    bill.isVoided = true;
    bill.voidReason = req.body.reason?.trim() || 'Voided by user';
    bill.voidedAt = new Date();
    bill.voidedBy = req.user._id;

    await bill.save();
    await logActivity(req, 'VOID_BILL', String(bill.billNo), {
      customer: bill.companyName,
      reason: bill.voidReason,
    });

    const updated = await Bill.findById(bill._id)
      .populate('createdBy', 'name')
      .populate('voidedBy', 'name');

    res.json({
      message: `Invoice #${bill.billNo} has been successfully voided.`,
      bill: updated,
    });
  } catch (error) {
    console.error('Void Bill Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/bills/:id/payments
 * Record a payment against an invoice (supports partial & full payments)
 */
router.post('/:id/payments', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const { amount, mode = 'Cash', reference = '', notes = '', date } = req.body;
    const paymentAmt = parseFloat(amount);

    if (isNaN(paymentAmt) || paymentAmt <= 0) {
      return res.status(400).json({ message: 'Payment amount must be a positive number.' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (bill.isVoided) {
      return res.status(400).json({ message: 'Cannot record payment for a voided invoice.' });
    }

    const billTotal = bill.grandTotal || bill.total || 0;
    const existingPaid = bill.paidAmount || (bill.paymentStatus === 'Paid' ? billTotal : 0);
    const remainingBalance = Math.max(0, billTotal - existingPaid);

    if (paymentAmt > remainingBalance + 0.01) {
      return res.status(400).json({
        message: `Payment amount (₹${paymentAmt}) cannot exceed remaining balance (₹${remainingBalance.toFixed(2)}).`,
      });
    }

    const newPaidAmount = Math.min(billTotal, Math.round((existingPaid + paymentAmt) * 100) / 100);
    const newStatus = newPaidAmount >= billTotal - 0.01 ? 'Paid' : 'Partial';

    bill.paidAmount = newPaidAmount;
    bill.paymentStatus = newStatus;

    if (!bill.payments) bill.payments = [];
    bill.payments.push({
      amount: paymentAmt,
      date: date ? new Date(date) : new Date(),
      mode,
      reference,
      notes,
      recordedBy: req.user._id,
    });

    await bill.save();

    await logActivity(req, 'RECORD_PAYMENT', String(bill.billNo), {
      customer: bill.companyName,
      paymentAmount: paymentAmt,
      mode,
      reference,
      newStatus,
      paidAmount: newPaidAmount,
      total: billTotal,
    });

    const populated = await Bill.findById(bill._id).populate('createdBy', 'name');

    res.json({
      message: `Payment of ₹${paymentAmt.toLocaleString('en-IN')} recorded successfully for Invoice #${bill.billNo}.`,
      bill: populated,
    });
  } catch (error) {
    console.error('Record Payment Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/bills/:id/payments
 * Get payment history for an invoice
 */
router.get('/:id/payments', protect, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('payments.recordedBy', 'name role')
      .lean();

    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      billNo: bill.billNo,
      companyName: bill.companyName,
      total: bill.grandTotal || bill.total || 0,
      paidAmount: bill.paidAmount || (bill.paymentStatus === 'Paid' ? (bill.grandTotal || bill.total || 0) : 0),
      balanceDue: Math.max(0, (bill.grandTotal || bill.total || 0) - (bill.paidAmount || (bill.paymentStatus === 'Paid' ? (bill.grandTotal || bill.total || 0) : 0))),
      paymentStatus: bill.paymentStatus,
      payments: bill.payments || [],
    });
  } catch (error) {
    console.error('Get Payments Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/bills/:id/payment-status
 * Update payment status (Owner and Admin only)
 */
router.patch('/:id/payment-status', protect, restrictTo('owner', 'admin'), [
  body('paymentStatus').isIn(['Pending', 'Partial', 'Paid']).withMessage('Payment status must be Pending, Partial, or Paid'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (bill.isVoided) {
      return res.status(400).json({ message: 'Cannot change payment status of a voided invoice.' });
    }

    const newStatus = req.body.paymentStatus;
    const billTotal = bill.grandTotal || bill.total || 0;

    bill.paymentStatus = newStatus;
    if (newStatus === 'Paid') {
      bill.paidAmount = billTotal;
    } else if (newStatus === 'Pending') {
      bill.paidAmount = 0;
    }

    await bill.save();

    await logActivity(req, 'UPDATE_PAYMENT_STATUS', String(bill.billNo), {
      customer: bill.companyName,
      status: bill.paymentStatus,
    });

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

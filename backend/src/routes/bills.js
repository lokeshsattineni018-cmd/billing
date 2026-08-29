const express = require('express');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const Settings = require('../models/Settings');
const { getNextSequence } = require('../models/Counter');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/bills/ledger
 * Customer Ledger with total invoiced, paid, and outstanding balances
 * (Excludes voided bills)
 */
router.get('/ledger', protect, async (req, res) => {
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search) {
      const search = req.query.search.trim();
      const billNoSearch = parseInt(search);

      if (!isNaN(billNoSearch)) {
        filter.$or = [
          { billNo: billNoSearch },
          { companyName: { $regex: search, $options: 'i' } },
        ];
      } else {
        filter.companyName = { $regex: search, $options: 'i' };
      }
    }

    if (req.query.customer) {
      filter.companyName = req.query.customer;
    }

    if (req.query.status) {
      filter.paymentStatus = req.query.status;
    }

    if (req.query.voided === 'true') {
      filter.isVoided = true;
    } else if (req.query.voided === 'false') {
      filter.isVoided = { $ne: true };
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) {
        filter.date.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }

    // Export all if limit === -1
    const isExport = req.query.limit === '-1' || req.query.all === 'true';

    const [bills, total] = await Promise.all([
      isExport
        ? Bill.find(filter).populate('createdBy', 'name').populate('voidedBy', 'name').sort({ billNo: -1 })
        : Bill.find(filter).populate('createdBy', 'name').populate('voidedBy', 'name').sort({ billNo: -1 }).skip(skip).limit(limit),
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
 * GET /api/bills/:id
 * Get a single bill by ID
 */
router.get('/:id', protect, async (req, res) => {
  try {
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

  // Traditional mandi trade total = subtotal (or subtotal + tax if applied)
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
 * Create a new invoice with server-side calculation and route-level validation
 */
router.post('/', protect, [
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

    // Fetch GSTIN dynamically from Settings (Task 4: Remove hardcoded fallback)
    let settings = await Settings.findOne();
    if (!settings || !settings.gstin) {
      return res.status(400).json({
        message: 'Business GSTIN is not configured in Settings. Please set your business GSTIN in the Settings page first.',
      });
    }

    const gstin = (companyGstin?.trim() || settings.gstin).trim();

    // Prepare items array
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

    // 1. Server-Side Recalculation & Total Verification (Task 1)
    let calculated;
    try {
      calculated = calculateVerifiedBillTotals(items, cgstAmount, sgstAmount, igstAmount);
    } catch (calcErr) {
      return res.status(400).json({ message: calcErr.message });
    }

    const clientProvidedTotal = parseFloat(total) || parseFloat(grandTotal) || 0;
    // Verify client total matches within 1.00 rounding tolerance (either subtotal or grandTotal with tax)
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
      customerPhone: customerPhone ? customerPhone.replace(/\D/g, '') : '',
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

    const populatedBill = await Bill.findById(bill._id).populate('createdBy', 'name');
    res.status(201).json(populatedBill);
  } catch (error) {
    console.error('Create Bill Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/bills/:id
 * Edit existing invoice (Task 2: Same-day typo correction window)
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

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (bill.isVoided) {
      return res.status(400).json({ message: 'Cannot edit a voided invoice.' });
    }

    // Check same-day edit window (unless user is admin)
    const billDate = new Date(bill.createdAt || bill.date);
    const today = new Date();
    const isSameDay = billDate.toDateString() === today.toDateString();

    if (!isSameDay && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({
        message: 'Invoices can only be edited on the same calendar day they were issued.',
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
    if (customerPhone !== undefined) bill.customerPhone = customerPhone.replace(/\D/g, '');
    if (date) bill.date = new Date(date);
    if (paymentStatus) bill.paymentStatus = paymentStatus;

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
    const updated = await Bill.findById(bill._id).populate('createdBy', 'name');
    res.json(updated);
  } catch (error) {
    console.error('Update Bill Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/bills/:id/void
 * Void an invoice (Task 2: Keep record in DB for audit trail, never hard-delete)
 */
router.patch('/:id/void', protect, [
  body('reason').optional().trim(),
], async (req, res) => {
  try {
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
 * PATCH /api/bills/:id/payment-status
 * Update payment status (Owner and Admin only)
 */
router.patch('/:id/payment-status', protect, restrictTo('owner', 'admin'), [
  body('paymentStatus').isIn(['Pending', 'Paid']).withMessage('Payment status must be Pending or Paid'),
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

    bill.paymentStatus = req.body.paymentStatus;
    await bill.save();

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

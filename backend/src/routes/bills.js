const express = require('express');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const { getNextSequence } = require('../models/Counter');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/bills/ledger
 * Customer Ledger with total invoiced, paid, and outstanding balances
 */
router.get('/ledger', protect, async (req, res) => {
  try {
    const customers = await Bill.aggregate([
      {
        $match: {
          companyName: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] },
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
        ? Bill.find(filter).populate('createdBy', 'name').sort({ billNo: -1 })
        : Bill.find(filter).populate('createdBy', 'name').sort({ billNo: -1 }).skip(skip).limit(limit),
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
    const bill = await Bill.findById(req.params.id).populate('createdBy', 'name');
    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/bills
 * Create a new invoice with table fields & multiple items
 */
router.post('/', protect, [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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

    const gstin = companyGstin?.trim() || '37KATPS1500Q1ZR';

    if (!items || !Array.isArray(items) || items.length === 0) {
      const q = parseFloat(quantity) || 0;
      const r = parseFloat(rate) || 0;
      const amt = Math.round(q * r * 100) / 100;
      items = [{
        sno: 1,
        particulars: particulars || 'Fresh Seafood / Prawns Supply',
        hsn: hsn || '0306',
        quantity: q,
        rate: r,
        taxRate: '',
        amount: amt,
      }];
    }

    const calculatedTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const mainQty = items[0]?.quantity || parseFloat(quantity) || 0;
    const mainRate = items[0]?.rate || parseFloat(rate) || 0;
    const finalTotal = total || Math.round(calculatedTotal * 100) / 100;
    const finalGrandTotal = grandTotal || finalTotal;

    const billNo = await getNextSequence('billNo');

    const bill = await Bill.create({
      billNo,
      date: date ? new Date(date) : new Date(),
      companyName: companyName.trim(),
      companyGstin: gstin,
      customerPhone: customerPhone || '',
      particulars: items[0]?.particulars || 'Fresh Seafood / Prawns Supply',
      hsn: items[0]?.hsn || '0306',
      quantity: mainQty,
      rate: mainRate,
      items,
      taxableValue: taxableValue || 0,
      cgstRate: cgstRate || '',
      cgstAmount: cgstAmount || 0,
      sgstRate: sgstRate || '',
      sgstAmount: sgstAmount || 0,
      igstRate: igstRate || '',
      igstAmount: igstAmount || 0,
      total: finalTotal,
      grandTotal: finalGrandTotal,
      paymentStatus: paymentStatus === 'Paid' ? 'Paid' : 'Pending',
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

    bill.paymentStatus = req.body.paymentStatus;
    await bill.save();

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

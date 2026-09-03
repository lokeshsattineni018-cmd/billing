const express = require('express');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const { protect, restrictTo } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

/**
 * GET /api/customers
 * Get all customers with lifetime sales, unpaid balance, and credit limit status (Admin only)
 */
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { search = '' } = req.query;

    // Aggregate lifetime stats from Bills (accounting for partial payments)
    const billStats = await Bill.aggregate([
      {
        $match: {
          companyName: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] },
          isVoided: { $ne: true },
        },
      },
      {
        $project: {
          companyName: 1,
          date: 1,
          customerPhone: 1,
          companyGstin: 1,
          totalAmount: { $ifNull: ['$grandTotal', '$total'] },
          paidAmount: {
            $cond: [
              { $eq: ['$paymentStatus', 'Paid'] },
              { $ifNull: ['$grandTotal', '$total'] },
              { $ifNull: ['$paidAmount', 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$companyName',
          totalInvoiced: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          outstandingBalance: {
            $sum: { $max: [0, { $subtract: ['$totalAmount', '$paidAmount'] }] },
          },
          totalBills: { $sum: 1 },
          lastBillDate: { $max: '$date' },
          lastPhone: { $last: '$customerPhone' },
          lastGstin: { $last: '$companyGstin' },
        },
      },
    ]);

    // Fetch custom customer configs (credit limits, custom phones, notes)
    const customDocs = await Customer.find().lean();
    const customMap = new Map(customDocs.map((c) => [c.name.toLowerCase().trim(), c]));

    // Merge bill aggregates with custom customer master data
    let merged = billStats.map((stat) => {
      const key = stat._id.toLowerCase().trim();
      const custom = customMap.get(key) || {};
      const creditLimit = custom.creditLimit || 0;
      const outstanding = stat.outstandingBalance || 0;

      let creditStatus = 'NORMAL';
      if (creditLimit > 0) {
        if (outstanding > creditLimit) creditStatus = 'EXCEEDED';
        else if (outstanding >= creditLimit * 0.8) creditStatus = 'WARNING';
      }

      return {
        _id: custom._id || stat._id,
        name: stat._id,
        phone: custom.phone || stat.lastPhone || '',
        gstin: custom.gstin || stat.lastGstin || '',
        address: custom.address || '',
        notes: custom.notes || '',
        creditLimit,
        creditStatus,
        creditUsedPercent: creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0,
        totalInvoiced: stat.totalInvoiced,
        totalPaid: stat.totalPaid,
        outstandingBalance: stat.outstandingBalance,
        totalBills: stat.totalBills,
        lastBillDate: stat.lastBillDate,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      merged = merged.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.gstin.toLowerCase().includes(q)
      );
    }

    merged.sort((a, b) => b.outstandingBalance - a.outstandingBalance || b.totalInvoiced - a.totalInvoiced);

    res.json(merged);
  } catch (error) {
    console.error('Customers list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/customers/:name/bills
 * Get all bills for a specific customer with payment breakdown
 */
router.get('/:name/bills', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name } = req.params;
    const bills = await Bill.find({
      companyName: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isVoided: { $ne: true },
    })
      .sort({ date: -1, billNo: -1 })
      .lean();

    const formatted = bills.map((b) => {
      const total = b.grandTotal || b.total || 0;
      const paid = b.paymentStatus === 'Paid' ? total : (b.paidAmount || 0);
      const balance = Math.max(0, total - paid);
      return {
        _id: b._id,
        billNo: b.billNo,
        date: b.date,
        total,
        paidAmount: paid,
        balanceDue: balance,
        paymentStatus: b.paymentStatus,
        payments: b.payments || [],
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Customer bills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/customers/:name/record-payment
 * Record a lump sum payment for a customer that settles oldest bills in FIFO order
 */
router.post('/:name/record-payment', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name } = req.params;
    const { amount, mode = 'Cash', reference = '', notes = '', date } = req.body;
    let paymentRem = parseFloat(amount);

    if (isNaN(paymentRem) || paymentRem <= 0) {
      return res.status(400).json({ message: 'Payment amount must be a positive number.' });
    }

    // Find all unpaid or partially paid bills for this customer sorted by oldest date
    const unpaidBills = await Bill.find({
      companyName: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isVoided: { $ne: true },
      paymentStatus: { $ne: 'Paid' },
    }).sort({ date: 1, billNo: 1 });

    if (unpaidBills.length === 0) {
      return res.status(400).json({ message: 'This customer has no pending or partially paid invoices.' });
    }

    let settledBills = [];
    const paymentDate = date ? new Date(date) : new Date();

    for (const bill of unpaidBills) {
      if (paymentRem <= 0.001) break;

      const billTotal = bill.grandTotal || bill.total || 0;
      const existingPaid = bill.paidAmount || (bill.paymentStatus === 'Paid' ? billTotal : 0);
      const balanceDue = Math.max(0, billTotal - existingPaid);

      if (balanceDue <= 0) continue;

      const allocatedAmt = Math.min(paymentRem, balanceDue);
      const newPaid = Math.round((existingPaid + allocatedAmt) * 100) / 100;
      const newStatus = newPaid >= billTotal - 0.01 ? 'Paid' : 'Partial';

      bill.paidAmount = newPaid;
      bill.paymentStatus = newStatus;

      if (!bill.payments) bill.payments = [];
      bill.payments.push({
        amount: allocatedAmt,
        date: paymentDate,
        mode,
        reference: reference || `Lump-sum Payment`,
        notes,
        recordedBy: req.user._id,
      });

      await bill.save();
      settledBills.push({ billNo: bill.billNo, allocated: allocatedAmt, newStatus });

      paymentRem -= allocatedAmt;
    }

    await logActivity(req, 'RECORD_PAYMENT', name, {
      customer: name,
      totalPaid: parseFloat(amount),
      allocatedTo: settledBills,
      mode,
      reference,
    });

    res.json({
      message: `Payment of ₹${parseFloat(amount).toLocaleString('en-IN')} applied across ${settledBills.length} invoice(s).`,
      settledBills,
    });
  } catch (error) {
    console.error('Customer lump sum payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/customers/:name/credit-limit
 * Update credit limit for a customer (Admin only)
 */
router.put('/:name/credit-limit', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name } = req.params;
    const { creditLimit, phone, gstin, address, notes } = req.body;

    const limitNum = Math.max(0, parseFloat(creditLimit) || 0);

    const customer = await Customer.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } },
      {
        $set: {
          name: name.trim(),
          creditLimit: limitNum,
          ...(phone !== undefined && { phone }),
          ...(gstin !== undefined && { gstin }),
          ...(address !== undefined && { address }),
          ...(notes !== undefined && { notes }),
        },
      },
      { upsert: true, new: true }
    );

    await logActivity(req, 'SET_CREDIT_LIMIT', name, {
      creditLimit: limitNum,
      customer: name,
    });

    res.json({
      message: `Credit limit updated for ${name}`,
      customer,
    });
  } catch (error) {
    console.error('Update credit limit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

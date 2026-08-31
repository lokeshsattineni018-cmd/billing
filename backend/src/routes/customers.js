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

    // Aggregate lifetime stats from Bills
    const billStats = await Bill.aggregate([
      {
        $match: {
          companyName: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] },
          isVoided: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$companyName',
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

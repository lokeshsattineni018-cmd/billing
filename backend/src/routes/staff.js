const express = require('express');
const { body, validationResult } = require('express-validator');
const StaffWork = require('../models/StaffWork');
const { protect, restrictTo } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');
const { logActivity } = require('../utils/activityLogger');
const { handleServerError, captureException } = require('../utils/errorTracker');

const router = express.Router();

/**
 * GET /api/staff
 * Retrieve staff work & attendance entries with search & filters
 */
router.get('/', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus, workType, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (search) {
      const sanitized = escapeRegex(search.trim());
      filter.staffName = { $regex: sanitized, $options: 'i' };
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

    if (workType) {
      filter.workType = workType;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [entries, totalCount] = await Promise.all([
      StaffWork.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      StaffWork.countDocuments(filter),
    ]);

    return res.json({
      entries,
      totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch staff work entries', req);
  }
});

/**
 * GET /api/staff/summary
 * Aggregate metrics & Per-staff "for all accounts" ledger breakdown
 */
router.get('/summary', protect, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Overall Totals
    const overallAgg = await StaffWork.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalKg: { $sum: '$quantity' },
          totalWages: { $sum: '$totalAmount' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', { $ifNull: ['$amountPaid', 0] }],
            },
          },
          totalPending: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'Paid'] },
                0,
                { $subtract: ['$totalAmount', { $ifNull: ['$amountPaid', 0] }] },
              ],
            },
          },
        },
      },
    ]);

    // 2. Today's Totals
    const todayAgg = await StaffWork.aggregate([
      {
        $match: {
          date: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          todayWorkersCount: { $addToSet: '$staffName' },
          todayKg: { $sum: '$quantity' },
          todayWages: { $sum: '$totalAmount' },
        },
      },
    ]);

    // 3. Per-Staff Accounts Breakdown ("how much they worked for all accounts")
    const perStaffAgg = await StaffWork.aggregate([
      {
        $group: {
          _id: '$staffName',
          staffName: { $first: '$staffName' },
          staffPhone: { $last: '$staffPhone' },
          totalDaysWorked: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
          totalEntries: { $sum: 1 },
          totalKg: { $sum: '$quantity' },
          totalEarned: { $sum: '$totalAmount' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', { $ifNull: ['$amountPaid', 0] }],
            },
          },
          pendingBalance: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'Paid'] },
                0,
                { $subtract: ['$totalAmount', { $ifNull: ['$amountPaid', 0] }] },
              ],
            },
          },
          lastWorkedDate: { $max: '$date' },
        },
      },
      {
        $project: {
          staffName: 1,
          staffPhone: 1,
          totalEntries: 1,
          daysWorkedCount: { $size: '$totalDaysWorked' },
          totalKg: { $round: ['$totalKg', 2] },
          totalEarned: { $round: ['$totalEarned', 2] },
          totalPaid: { $round: ['$totalPaid', 2] },
          pendingBalance: { $round: ['$pendingBalance', 2] },
          avgRate: {
            $cond: [
              { $gt: ['$totalKg', 0] },
              { $round: [{ $divide: ['$totalEarned', '$totalKg'] }, 2] },
              0,
            ],
          },
          lastWorkedDate: 1,
        },
      },
      { $sort: { pendingBalance: -1, totalEarned: -1, totalKg: -1 } },
    ]);

    const overall = overallAgg[0] || {
      totalEntries: 0,
      totalKg: 0,
      totalWages: 0,
      totalPaid: 0,
      totalPending: 0,
    };

    const today = todayAgg[0]
      ? {
          todayWorkersCount: todayAgg[0].todayWorkersCount?.length || 0,
          todayKg: Math.round((todayAgg[0].todayKg || 0) * 100) / 100,
          todayWages: Math.round((todayAgg[0].todayWages || 0) * 100) / 100,
        }
      : {
          todayWorkersCount: 0,
          todayKg: 0,
          todayWages: 0,
        };

    return res.json({
      overall: {
        totalEntries: overall.totalEntries || 0,
        totalWorkers: perStaffAgg.length || 0,
        totalKg: Math.round((overall.totalKg || 0) * 100) / 100,
        totalWages: Math.round((overall.totalWages || 0) * 100) / 100,
        totalPaid: Math.round((overall.totalPaid || 0) * 100) / 100,
        totalPending: Math.round((overall.totalPending || 0) * 100) / 100,
      },
      today,
      staffAccounts: perStaffAgg,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch staff summary metrics', req);
  }
});

/**
 * GET /api/staff/names
 * List of distinct staff names for auto-complete dropdown
 */
router.get('/names', protect, async (req, res) => {
  try {
    const names = await StaffWork.distinct('staffName');
    return res.json(names.filter(Boolean).sort());
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch staff names', req);
  }
});

/**
 * POST /api/staff
 * Record a single staff work / attendance entry
 */
router.post(
  '/',
  protect,
  [
    body('staffName').trim().notEmpty().withMessage('Staff name is required'),
    body('quantity').isFloat({ min: 0.01 }).withMessage('Valid quantity (kg) is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price per kg is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    }

    try {
      const {
        staffName,
        staffPhone,
        date,
        quantity,
        price,
        workType,
        shift,
        paymentStatus,
        notes,
      } = req.body;

      const numQty = parseFloat(quantity);
      const numPrice = parseFloat(price);
      const totalAmount = Math.round(numQty * numPrice * 100) / 100;
      const isPaid = paymentStatus === 'Paid';

      const entry = await StaffWork.create({
        staffName: staffName.trim(),
        staffPhone: staffPhone ? staffPhone.trim() : '',
        date: date ? new Date(date) : new Date(),
        quantity: numQty,
        price: numPrice,
        totalAmount,
        workType: workType || 'Peeling / Seafood Processing',
        shift: shift || 'Full Day',
        paymentStatus: isPaid ? 'Paid' : 'Pending',
        amountPaid: isPaid ? totalAmount : 0,
        paymentDate: isPaid ? new Date() : null,
        notes: notes ? notes.trim() : '',
        recordedBy: req.user._id,
        recordedByName: req.user.name || '',
      });

      await logActivity(req, 'STAFF_WORK_RECORDED', entry._id, {
        staffName: entry.staffName,
        quantity: entry.quantity,
        price: entry.price,
        totalAmount: entry.totalAmount,
      });

      return res.status(201).json({
        message: `Work recorded for ${entry.staffName}: ${entry.quantity} kg @ ₹${entry.price} = ₹${entry.totalAmount}`,
        entry,
      });
    } catch (error) {
      return handleServerError(res, error, 'Failed to record staff work entry', req);
    }
  }
);

/**
 * POST /api/staff/bulk
 * Record multiple staff entries for a given date at once
 */
router.post('/bulk', protect, async (req, res) => {
  try {
    const { date, entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'Entries array is required and cannot be empty' });
    }

    const workDate = date ? new Date(date) : new Date();
    const docsToInsert = [];

    for (const item of entries) {
      const staffName = item.staffName?.trim();
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price);

      if (!staffName || isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
        continue;
      }

      const totalAmount = Math.round(quantity * price * 100) / 100;
      const isPaid = item.paymentStatus === 'Paid';

      docsToInsert.push({
        staffName,
        staffPhone: item.staffPhone ? item.staffPhone.trim() : '',
        date: workDate,
        quantity,
        price,
        totalAmount,
        workType: item.workType || 'Peeling / Seafood Processing',
        shift: item.shift || 'Full Day',
        paymentStatus: isPaid ? 'Paid' : 'Pending',
        amountPaid: isPaid ? totalAmount : 0,
        paymentDate: isPaid ? new Date() : null,
        notes: item.notes ? item.notes.trim() : '',
        recordedBy: req.user._id,
        recordedByName: req.user.name || '',
      });
    }

    if (docsToInsert.length === 0) {
      return res.status(400).json({ message: 'No valid entries provided' });
    }

    const created = await StaffWork.insertMany(docsToInsert);

    await logActivity(req, 'STAFF_WORK_BULK_RECORDED', '', {
      count: created.length,
      date: workDate,
    });

    return res.status(201).json({
      message: `Successfully saved ${created.length} staff work entries!`,
      count: created.length,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to save bulk staff entries', req);
  }
});

/**
 * PUT /api/staff/:id
 * Update an existing work entry
 */
router.put('/:id', protect, async (req, res) => {
  try {
    const {
      staffName,
      staffPhone,
      date,
      quantity,
      price,
      workType,
      shift,
      paymentStatus,
      amountPaid,
      notes,
    } = req.body;

    const entry = await StaffWork.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Staff work entry not found' });
    }

    if (staffName) entry.staffName = staffName.trim();
    if (staffPhone !== undefined) entry.staffPhone = staffPhone.trim();
    if (date) entry.date = new Date(date);
    if (quantity != null) entry.quantity = parseFloat(quantity);
    if (price != null) entry.price = parseFloat(price);
    if (workType) entry.workType = workType;
    if (shift) entry.shift = shift;
    if (notes !== undefined) entry.notes = notes.trim();

    entry.totalAmount = Math.round(entry.quantity * entry.price * 100) / 100;

    if (paymentStatus) {
      entry.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid') {
        entry.amountPaid = entry.totalAmount;
        if (!entry.paymentDate) entry.paymentDate = new Date();
      } else {
        entry.amountPaid = amountPaid != null ? parseFloat(amountPaid) : 0;
      }
    }

    await entry.save();

    await logActivity(req, 'STAFF_WORK_UPDATED', entry._id, {
      staffName: entry.staffName,
      quantity: entry.quantity,
      price: entry.price,
      totalAmount: entry.totalAmount,
    });

    return res.json({ message: 'Work entry updated successfully', entry });
  } catch (error) {
    return handleServerError(res, error, 'Failed to update staff work entry', req);
  }
});

/**
 * PATCH /api/staff/:id/pay
 * Toggle or mark an entry as Paid / Pending
 */
router.patch('/:id/pay', protect, async (req, res) => {
  try {
    const { status, paymentMode } = req.body;
    const entry = await StaffWork.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Staff work entry not found' });
    }

    const newStatus = status || (entry.paymentStatus === 'Paid' ? 'Pending' : 'Paid');
    entry.paymentStatus = newStatus;

    if (newStatus === 'Paid') {
      entry.amountPaid = entry.totalAmount;
      entry.paymentDate = new Date();
      if (paymentMode) entry.paymentMode = paymentMode;
    } else {
      entry.amountPaid = 0;
      entry.paymentDate = null;
    }

    await entry.save();

    await logActivity(req, 'STAFF_WORK_PAYMENT_TOGGLED', entry._id, {
      staffName: entry.staffName,
      status: entry.paymentStatus,
      amount: entry.totalAmount,
    });

    return res.json({
      message: `Payment status updated to ${entry.paymentStatus} for ${entry.staffName}`,
      entry,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to update payment status', req);
  }
});

/**
 * DELETE /api/staff/:id
 * Delete a work entry
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const entry = await StaffWork.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Staff work entry not found' });
    }

    await StaffWork.findByIdAndDelete(req.params.id);

    await logActivity(req, 'STAFF_WORK_DELETED', req.params.id, {
      staffName: entry.staffName,
      totalAmount: entry.totalAmount,
    });

    return res.json({ message: `Entry for ${entry.staffName} removed successfully` });
  } catch (error) {
    return handleServerError(res, error, 'Failed to delete staff work entry', req);
  }
});

/**
 * GET /api/staff/export
 * Download CSV file of staff work and wages for accounting & payout
 */
router.get('/export', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus } = req.query;

    const filter = {};
    if (search) {
      filter.staffName = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        d.setHours(0, 0, 0, 0);
        filter.date.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        filter.date.$lte = d;
      }
    }
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    const entries = await StaffWork.find(filter).sort({ date: -1, staffName: 1 }).lean();

    const headers = [
      'Date',
      'Staff Name',
      'Phone Number',
      'Work Type',
      'Shift',
      'Quantity (KG)',
      'Price Per KG (INR)',
      'Total Amount (INR)',
      'Payment Status',
      'Payment Date',
      'Payment Mode',
      'Notes',
    ];

    const rows = entries.map((e) => {
      const dStr = new Date(e.date).toLocaleDateString('en-IN');
      const pDateStr = e.paymentDate ? new Date(e.paymentDate).toLocaleDateString('en-IN') : '';
      return [
        dStr,
        `"${(e.staffName || '').replace(/"/g, '""')}"`,
        `"${(e.staffPhone || '').replace(/"/g, '""')}"`,
        `"${(e.workType || '').replace(/"/g, '""')}"`,
        e.shift || 'Full Day',
        (e.quantity || 0).toFixed(2),
        (e.price || 0).toFixed(2),
        (e.totalAmount || 0).toFixed(2),
        e.paymentStatus || 'Pending',
        pDateStr,
        e.paymentMode || '',
        `"${(e.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const filename = `Staff_Wages_Report_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return handleServerError(res, error, 'Failed to export staff work report', req);
  }
});

module.exports = router;

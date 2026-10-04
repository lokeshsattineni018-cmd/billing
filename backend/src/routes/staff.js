const express = require('express');
const { body, validationResult } = require('express-validator');
const StaffWork = require('../models/StaffWork');
const DailyIce = require('../models/DailyIce');
const DailyWastage = require('../models/DailyWastage');
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
    const { dateFrom, dateTo, dateFilter } = req.query;

    // Build period filter
    let periodMatch = {};
    if (dateFilter === 'all' && !dateFrom && !dateTo) {
      periodMatch = {};
    } else if (dateFrom || dateTo) {
      periodMatch.date = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        dFrom.setHours(0, 0, 0, 0);
        periodMatch.date.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        periodMatch.date.$lte = dTo;
      }
    } else {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodMatch = { date: { $gte: startOfToday, $lte: endOfToday } };
    }

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

    // 2. Period Totals (dynamic based on dateFrom/dateTo)
    const periodAgg = await StaffWork.aggregate([
      {
        $match: periodMatch,
      },
      {
        $group: {
          _id: null,
          todayWorkersCount: { $addToSet: '$staffName' },
          todayKg: { $sum: '$quantity' },
          todayWages: { $sum: '$totalAmount' },
          periodPending: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'Paid'] },
                0,
                { $subtract: ['$totalAmount', { $ifNull: ['$amountPaid', 0] }] },
              ],
            },
          },
          periodPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', { $ifNull: ['$amountPaid', 0] }],
            },
          },
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

    const today = periodAgg[0]
      ? {
          todayWorkersCount: periodAgg[0].todayWorkersCount?.length || 0,
          todayKg: Math.round((periodAgg[0].todayKg || 0) * 100) / 100,
          todayWages: Math.round((periodAgg[0].todayWages || 0) * 100) / 100,
          periodPending: Math.round((periodAgg[0].periodPending || 0) * 100) / 100,
          periodPaid: Math.round((periodAgg[0].periodPaid || 0) * 100) / 100,
        }
      : {
          todayWorkersCount: 0,
          todayKg: 0,
          todayWages: 0,
          periodPending: 0,
          periodPaid: 0,
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

// ==========================================
// DAILY ICE USAGE TRACKER
// ==========================================

/**
 * GET /api/staff/ice
 * List ice blocks usage records
 */
router.get('/ice', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      const sanitized = escapeRegex(search.trim());
      filter.$or = [
        { supplierName: { $regex: sanitized, $options: 'i' } },
        { iceFrom: { $regex: sanitized, $options: 'i' } },
        { iceTo: { $regex: sanitized, $options: 'i' } },
        { vehicleNo: { $regex: sanitized, $options: 'i' } },
        { notes: { $regex: sanitized, $options: 'i' } },
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

    if (paymentStatus && ['Paid', 'Pending'].includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [entries, totalCount] = await Promise.all([
      DailyIce.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      DailyIce.countDocuments(filter),
    ]);

    return res.json({
      entries,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch ice records', req);
  }
});

/**
 * GET /api/staff/ice/summary
 * Summary of ice blocks used today & overall
 */
router.get('/ice/summary', protect, async (req, res) => {
  try {
    const { dateFrom, dateTo, dateFilter } = req.query;

    // Build date filter for "period" metrics (replaces hardcoded "today")
    let periodFilter = {};
    if (dateFilter === 'all' && !dateFrom && !dateTo) {
      periodFilter = {};
    } else if (dateFrom || dateTo) {
      periodFilter.date = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        dFrom.setHours(0, 0, 0, 0);
        periodFilter.date.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        periodFilter.date.$lte = dTo;
      }
    } else {
      // Default to today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      periodFilter = { date: { $gte: todayStart, $lte: todayEnd } };
    }

    const [periodAgg, overallAgg] = await Promise.all([
      DailyIce.aggregate([
        { $match: periodFilter },
        {
          $group: {
            _id: null,
            periodBlocks: { $sum: '$blocks' },
            periodAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      DailyIce.aggregate([
        {
          $group: {
            _id: null,
            totalBlocks: { $sum: '$blocks' },
            totalAmount: { $sum: '$totalAmount' },
            totalEntries: { $sum: 1 },
          },
        },
      ]),
    ]);

    const period = periodAgg[0] || { periodBlocks: 0, periodAmount: 0 };
    const overall = overallAgg[0] || { totalBlocks: 0, totalAmount: 0, totalEntries: 0 };

    return res.json({
      todayBlocks: period.periodBlocks || 0,
      todayAmount: Math.round((period.periodAmount || 0) * 100) / 100,
      todayAvgRate: period.periodBlocks > 0 ? Math.round(((period.periodAmount || 0) / period.periodBlocks) * 100) / 100 : 0,
      totalBlocks: overall.totalBlocks || 0,
      totalAmount: Math.round((overall.totalAmount || 0) * 100) / 100,
      totalEntries: overall.totalEntries || 0,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch ice summary', req);
  }
});

/**
 * POST /api/staff/ice
 * Record daily ice blocks used
 */
router.post(
  '/ice',
  protect,
  [
    body('blocks').isFloat({ min: 0.01 }).withMessage('Valid number of ice blocks is required'),
    body('rate').isFloat({ min: 0 }).withMessage('Valid rate per ice block is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    }

    try {
      const { blocks, rate, date, supplierName, iceFrom, iceTo, vehicleNo, paymentStatus, notes } = req.body;
      const numBlocks = parseFloat(blocks);
      const numRate = parseFloat(rate);
      const totalAmount = Math.round(numBlocks * numRate * 100) / 100;

      const record = new DailyIce({
        date: date ? new Date(date) : new Date(),
        blocks: numBlocks,
        rate: numRate,
        totalAmount,
        supplierName: (supplierName || '').trim(),
        iceFrom: (iceFrom || '').trim(),
        iceTo: (iceTo || '').trim(),
        vehicleNo: (vehicleNo || '').trim(),
        paymentStatus: paymentStatus === 'Pending' ? 'Pending' : 'Paid',
        notes: (notes || '').trim(),
        createdBy: req.user._id,
      });

      await record.save();

      await logActivity(req, 'ICE_RECORDED', record._id, {
        targetType: 'ICE',
        blocks: record.blocks,
        rate: record.rate,
        totalAmount: record.totalAmount,
        iceFrom: record.iceFrom || record.supplierName || '',
        iceTo: record.iceTo || '',
        paymentStatus: record.paymentStatus,
      });

      return res.status(201).json({
        message: 'Ice blocks record saved successfully!',
        record,
      });
    } catch (error) {
      return handleServerError(res, error, 'Failed to save ice record', req);
    }
  }
);

/**
 * GET /api/staff/ice/export
 * Download CSV file of ice block purchases
 */
router.get('/ice/export', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus } = req.query;
    const filter = {};
    if (search) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { supplierName: { $regex: q, $options: 'i' } },
        { iceFrom: { $regex: q, $options: 'i' } },
        { iceTo: { $regex: q, $options: 'i' } },
      ];
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

    const records = await DailyIce.find(filter).sort({ date: -1 }).lean();
    const headers = ['Date', 'Ice From (Supplier)', 'Ice To (Receiver)', 'Blocks', 'Rate per Block (INR)', 'Total Amount (INR)', 'Payment Status', 'Vehicle No', 'Notes'];
    const rows = records.map((r) => {
      const dStr = new Date(r.date).toLocaleDateString('en-IN');
      return [
        dStr,
        `"${(r.iceFrom || r.supplierName || '').replace(/"/g, '""')}"`,
        `"${(r.iceTo || '').replace(/"/g, '""')}"`,
        r.blocks || 0,
        (r.rate || 0).toFixed(2),
        (r.totalAmount || 0).toFixed(2),
        r.paymentStatus || 'Paid',
        `"${(r.vehicleNo || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const filename = `Ice_Purchases_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return handleServerError(res, error, 'Failed to export ice report', req);
  }
});

/**
 * PUT /api/staff/ice/:id
 * Update ice record
 */
router.put('/ice/:id', protect, async (req, res) => {
  try {
    const { blocks, rate, date, supplierName, iceFrom, iceTo, vehicleNo, paymentStatus, notes } = req.body;
    const record = await DailyIce.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ice record not found' });
    }

    if (blocks !== undefined) record.blocks = parseFloat(blocks) || 0;
    if (rate !== undefined) record.rate = parseFloat(rate) || 0;
    record.totalAmount = Math.round(record.blocks * record.rate * 100) / 100;

    if (date) record.date = new Date(date);
    if (supplierName !== undefined) record.supplierName = supplierName.trim();
    if (iceFrom !== undefined) record.iceFrom = iceFrom.trim();
    if (iceTo !== undefined) record.iceTo = iceTo.trim();
    if (vehicleNo !== undefined) record.vehicleNo = vehicleNo.trim();
    if (paymentStatus) record.paymentStatus = paymentStatus;
    if (notes !== undefined) record.notes = notes.trim();

    await record.save();

    await logActivity(req, 'ICE_UPDATED', record._id, {
      targetType: 'ICE',
      blocks: record.blocks,
      rate: record.rate,
      totalAmount: record.totalAmount,
      iceFrom: record.iceFrom || record.supplierName || '',
      iceTo: record.iceTo || '',
      paymentStatus: record.paymentStatus,
    });

    return res.json({ message: 'Ice record updated successfully!', record });
  } catch (error) {
    return handleServerError(res, error, 'Failed to update ice record', req);
  }
});

/**
 * DELETE /api/staff/ice/:id
 * Delete ice record
 */
router.delete('/ice/:id', protect, async (req, res) => {
  try {
    const record = await DailyIce.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ice record not found' });
    }

    await logActivity(req, 'ICE_DELETED', req.params.id, {
      targetType: 'ICE',
      blocks: record.blocks,
      totalAmount: record.totalAmount,
      iceFrom: record.iceFrom || record.supplierName || '',
    });

    return res.json({ message: 'Ice record deleted successfully' });
  } catch (error) {
    return handleServerError(res, error, 'Failed to delete ice record', req);
  }
});

// ==========================================
// DAILY PRAWN HEAD WASTAGE SALES TRACKER
// ==========================================

/**
 * GET /api/staff/wastage
 * List prawn head wastage sales records
 */
router.get('/wastage', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      const sanitized = escapeRegex(search.trim());
      filter.$or = [
        { buyerName: { $regex: sanitized, $options: 'i' } },
        { vehicleNo: { $regex: sanitized, $options: 'i' } },
        { notes: { $regex: sanitized, $options: 'i' } },
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

    if (paymentStatus && ['Paid', 'Pending'].includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [entries, totalCount] = await Promise.all([
      DailyWastage.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      DailyWastage.countDocuments(filter),
    ]);

    return res.json({
      entries,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch wastage records', req);
  }
});

/**
 * GET /api/staff/wastage/summary
 * Summary of prawn head wastage sold today & overall
 */
router.get('/wastage/summary', protect, async (req, res) => {
  try {
    const { dateFrom, dateTo, dateFilter } = req.query;

    let periodFilter = {};
    if (dateFilter === 'all' && !dateFrom && !dateTo) {
      periodFilter = {};
    } else if (dateFrom || dateTo) {
      periodFilter.date = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        dFrom.setHours(0, 0, 0, 0);
        periodFilter.date.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        periodFilter.date.$lte = dTo;
      }
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      periodFilter = { date: { $gte: todayStart, $lte: todayEnd } };
    }

    const [periodAgg, overallAgg] = await Promise.all([
      DailyWastage.aggregate([
        { $match: periodFilter },
        {
          $group: {
            _id: null,
            periodKg: { $sum: '$quantityKg' },
            periodAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      DailyWastage.aggregate([
        {
          $group: {
            _id: null,
            totalKg: { $sum: '$quantityKg' },
            totalAmount: { $sum: '$totalAmount' },
            totalEntries: { $sum: 1 },
          },
        },
      ]),
    ]);

    const period = periodAgg[0] || { periodKg: 0, periodAmount: 0 };
    const overall = overallAgg[0] || { totalKg: 0, totalAmount: 0, totalEntries: 0 };

    return res.json({
      todayKg: Math.round((period.periodKg || 0) * 100) / 100,
      todayAmount: Math.round((period.periodAmount || 0) * 100) / 100,
      todayAvgRate: period.periodKg > 0 ? Math.round(((period.periodAmount || 0) / period.periodKg) * 100) / 100 : 0,
      totalKg: Math.round((overall.totalKg || 0) * 100) / 100,
      totalAmount: Math.round((overall.totalAmount || 0) * 100) / 100,
      totalEntries: overall.totalEntries || 0,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch wastage summary', req);
  }
});

/**
 * POST /api/staff/wastage
 * Record prawn head wastage sold
 */
router.post(
  '/wastage',
  protect,
  [
    body('quantityKg').isFloat({ min: 0.01 }).withMessage('Valid quantity (KG) is required'),
    body('rate').isFloat({ min: 0 }).withMessage('Valid rate per KG is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    }

    try {
      const { quantityKg, rate, date, category, buyerName, vehicleNo, paymentStatus, notes } = req.body;
      const numKg = parseFloat(quantityKg);
      const numRate = parseFloat(rate);
      const totalAmount = Math.round(numKg * numRate * 100) / 100;

      const record = new DailyWastage({
        date: date ? new Date(date) : new Date(),
        category: (category || 'Prawn Head').trim(),
        quantityKg: numKg,
        rate: numRate,
        totalAmount,
        buyerName: (buyerName || '').trim(),
        vehicleNo: (vehicleNo || '').trim(),
        paymentStatus: paymentStatus === 'Pending' ? 'Pending' : 'Paid',
        notes: (notes || '').trim(),
        createdBy: req.user._id,
      });

      await record.save();

      await logActivity(req, 'WASTAGE_RECORDED', record._id, {
        targetType: 'WASTAGE',
        category: record.category,
        quantityKg: record.quantityKg,
        rate: record.rate,
        totalAmount: record.totalAmount,
        buyerName: record.buyerName || '',
        paymentStatus: record.paymentStatus,
      });

      return res.status(201).json({
        message: 'Prawn head wastage sales record saved successfully!',
        record,
      });
    } catch (error) {
      return handleServerError(res, error, 'Failed to save wastage record', req);
    }
  }
);

/**
 * GET /api/staff/wastage/export
 * Download CSV file of prawn head wastage sales
 */
router.get('/wastage/export', protect, async (req, res) => {
  try {
    const { search, dateFrom, dateTo, paymentStatus } = req.query;
    const filter = {};
    if (search) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { buyerName: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
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

    const records = await DailyWastage.find(filter).sort({ date: -1 }).lean();
    const headers = ['Date', 'Category', 'Quantity (KG)', 'Rate per KG (INR)', 'Total Amount (INR)', 'Buyer Name', 'Payment Status', 'Vehicle No', 'Notes'];
    const rows = records.map((r) => {
      const dStr = new Date(r.date).toLocaleDateString('en-IN');
      return [
        dStr,
        `"${(r.category || 'Prawn Head').replace(/"/g, '""')}"`,
        (r.quantityKg || 0).toFixed(2),
        (r.rate || 0).toFixed(2),
        (r.totalAmount || 0).toFixed(2),
        `"${(r.buyerName || '').replace(/"/g, '""')}"`,
        r.paymentStatus || 'Paid',
        `"${(r.vehicleNo || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const filename = `Wastage_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return handleServerError(res, error, 'Failed to export wastage report', req);
  }
});

/**
 * PUT /api/staff/wastage/:id
 * Update wastage sales record
 */
router.put('/wastage/:id', protect, async (req, res) => {
  try {
    const { quantityKg, rate, date, category, buyerName, vehicleNo, paymentStatus, notes } = req.body;
    const record = await DailyWastage.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Wastage record not found' });
    }

    if (quantityKg !== undefined) record.quantityKg = parseFloat(quantityKg) || 0;
    if (rate !== undefined) record.rate = parseFloat(rate) || 0;
    record.totalAmount = Math.round(record.quantityKg * record.rate * 100) / 100;

    if (date) record.date = new Date(date);
    if (category !== undefined) record.category = category.trim();
    if (buyerName !== undefined) record.buyerName = buyerName.trim();
    if (vehicleNo !== undefined) record.vehicleNo = vehicleNo.trim();
    if (paymentStatus) record.paymentStatus = paymentStatus;
    if (notes !== undefined) record.notes = notes.trim();

    await record.save();

    await logActivity(req, 'WASTAGE_UPDATED', record._id, {
      targetType: 'WASTAGE',
      category: record.category,
      quantityKg: record.quantityKg,
      rate: record.rate,
      totalAmount: record.totalAmount,
      buyerName: record.buyerName || '',
      paymentStatus: record.paymentStatus,
    });

    return res.json({ message: 'Wastage record updated successfully!', record });
  } catch (error) {
    return handleServerError(res, error, 'Failed to update wastage record', req);
  }
});

/**
 * DELETE /api/staff/wastage/:id
 * Delete wastage sales record
 */
router.delete('/wastage/:id', protect, async (req, res) => {
  try {
    const record = await DailyWastage.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Wastage record not found' });
    }

    await logActivity(req, 'WASTAGE_DELETED', req.params.id, {
      targetType: 'WASTAGE',
      category: record.category,
      quantityKg: record.quantityKg,
      totalAmount: record.totalAmount,
    });

    return res.json({ message: 'Wastage record deleted successfully' });
  } catch (error) {
    return handleServerError(res, error, 'Failed to delete wastage record', req);
  }
});

/**
 * GET /api/staff/daily-operations
 * Consolidated summary for daily factory operations: Labor + Ice - Wastage
 */
router.get('/daily-operations', protect, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dStart = new Date(targetDate);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(targetDate);
    dEnd.setHours(23, 59, 59, 999);

    const matchQuery = { date: { $gte: dStart, $lte: dEnd } };

    const [laborAgg, iceAgg, wastageAgg] = await Promise.all([
      StaffWork.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalWorkers: { $addToSet: '$staffName' },
            totalKg: { $sum: '$quantity' },
            totalWages: { $sum: '$totalAmount' },
          },
        },
      ]),
      DailyIce.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalBlocks: { $sum: '$blocks' },
            totalCost: { $sum: '$totalAmount' },
          },
        },
      ]),
      DailyWastage.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalKg: { $sum: '$quantityKg' },
            totalRevenue: { $sum: '$totalAmount' },
          },
        },
      ]),
    ]);

    const labor = laborAgg[0]
      ? {
          workerCount: laborAgg[0].totalWorkers.length,
          totalKg: Math.round(laborAgg[0].totalKg * 100) / 100,
          totalWages: Math.round(laborAgg[0].totalWages * 100) / 100,
        }
      : { workerCount: 0, totalKg: 0, totalWages: 0 };

    const ice = iceAgg[0]
      ? {
          totalBlocks: iceAgg[0].totalBlocks,
          totalCost: Math.round(iceAgg[0].totalCost * 100) / 100,
        }
      : { totalBlocks: 0, totalCost: 0 };

    const wastage = wastageAgg[0]
      ? {
          totalKg: Math.round(wastageAgg[0].totalKg * 100) / 100,
          totalRevenue: Math.round(wastageAgg[0].totalRevenue * 100) / 100,
        }
      : { totalKg: 0, totalRevenue: 0 };

    const netDailyExpense = Math.round((labor.totalWages + ice.totalCost - wastage.totalRevenue) * 100) / 100;

    return res.json({
      date: targetDate.toISOString().slice(0, 10),
      labor,
      ice,
      wastage,
      netDailyExpense,
    });
  } catch (error) {
    return handleServerError(res, error, 'Failed to fetch daily operations summary', req);
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

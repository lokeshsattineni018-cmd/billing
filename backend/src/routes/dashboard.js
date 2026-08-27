const express = require('express');
const Bill = require('../models/Bill');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Today's sales, this month's sales, total receivables, total invoices, and recent invoices
 */
router.get('/summary', protect, async (req, res) => {
  try {
    const now = new Date();

    // Today's date range
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // This month's date range
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayStats, monthStats, receivablesStats, recentBills, totalBills] = await Promise.all([
      // Today's aggregation
      Bill.aggregate([
        { $match: { date: { $gte: startOfDay, $lt: endOfDay } } },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
      ]),
      // This month's aggregation
      Bill.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
      ]),
      // Total Outstanding Receivables
      Bill.aggregate([
        { $match: { paymentStatus: { $ne: 'Paid' } } },
        { $group: { _id: null, totalPending: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, pendingCount: { $sum: 1 } } },
      ]),
      // Recent invoices (last 10)
      Bill.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Total invoice count
      Bill.countDocuments(),
    ]);

    const today = todayStats[0] || { totalSales: 0, billCount: 0 };
    const month = monthStats[0] || { totalSales: 0, billCount: 0 };
    const receivables = receivablesStats[0] || { totalPending: 0, pendingCount: 0 };

    res.json({
      today: {
        totalSales: today.totalSales,
        billCount: today.billCount,
      },
      month: {
        totalSales: month.totalSales,
        billCount: month.billCount,
      },
      receivables: {
        totalPending: receivables.totalPending,
        pendingCount: receivables.pendingCount,
      },
      recentBills,
      totalBills,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

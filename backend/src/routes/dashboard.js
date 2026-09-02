const express = require('express');
const Bill = require('../models/Bill');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Today's sales, this month's sales, total receivables, total invoices, and recent invoices
 * (Owner and Admin only)
 */
router.get('/summary', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const now = new Date();

    // Today's date range
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // This month's date range
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayStats, monthStats, receivablesStats, recentBills, totalBills] = await Promise.all([
      // Today's aggregation (excluding voided bills)
      Bill.aggregate([
        { $match: { date: { $gte: startOfDay, $lt: endOfDay }, isVoided: { $ne: true } } },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
      ]),
      // This month's aggregation (excluding voided bills)
      Bill.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth }, isVoided: { $ne: true } } },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
      ]),
      // Total Outstanding Receivables (excluding voided bills)
      Bill.aggregate([
        { $match: { paymentStatus: { $ne: 'Paid' }, isVoided: { $ne: true } } },
        { $group: { _id: null, totalPending: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, pendingCount: { $sum: 1 } } },
      ]),
      // Recent invoices (last 10)
      Bill.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Total invoice count
      Bill.countDocuments({ isVoided: { $ne: true } }),
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

/**
 * GET /api/dashboard/daily-summary
 * Detailed daily business summary with top buyer and WhatsApp-formatted message
 * (Owner and Admin only)
 */
router.get('/daily-summary', protect, restrictTo('owner', 'admin'), async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayBills, monthStats, receivablesStats, topBuyerToday, topBuyerMonth] = await Promise.all([
      // All today's bills
      Bill.find({ date: { $gte: startOfDay, $lt: endOfDay } }).lean(),
      // Month stats
      Bill.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
      ]),
      // Outstanding receivables
      Bill.aggregate([
        { $match: { paymentStatus: { $ne: 'Paid' } } },
        { $group: { _id: null, totalPending: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, pendingCount: { $sum: 1 } } },
      ]),
      // Top buyer today
      Bill.aggregate([
        { $match: { date: { $gte: startOfDay, $lt: endOfDay } } },
        { $group: { _id: '$companyName', totalAmount: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 1 },
      ]),
      // Top buyer this month
      Bill.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: '$companyName', totalAmount: { $sum: { $ifNull: ['$grandTotal', '$total'] } }, billCount: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const todaySales = todayBills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);
    const todayCount = todayBills.length;
    const month = monthStats[0] || { totalSales: 0, billCount: 0 };
    const receivables = receivablesStats[0] || { totalPending: 0, pendingCount: 0 };
    const topToday = topBuyerToday[0] || null;
    const topMonth = topBuyerMonth[0] || null;

    // Format date for message
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Format Rs. amounts
    const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    // Build WhatsApp message
    let msg = `🏢 *VIJAYA DURGA AGENCIES*\n📊 *Daily Business Summary*\n📅 ${dateStr}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Today's Sales:* ${fmt(todaySales)}\n`;
    msg += `🧾 *Bills Created:* ${todayCount}\n`;
    if (topToday) {
      msg += `👤 *Top Buyer Today:* ${topToday._id} (${fmt(topToday.totalAmount)})\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📆 *${monthName} Total:* ${fmt(month.totalSales)} (${month.billCount} bills)\n`;
    if (topMonth) {
      msg += `🏆 *Top Buyer (Month):* ${topMonth._id} (${fmt(topMonth.totalAmount)})\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚠️ *Outstanding Receivables:* ${fmt(receivables.totalPending)} (${receivables.pendingCount} bills)\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `\n_Sent from Vijaya Durga Agencies Billing App_`;

    res.json({
      today: { totalSales: todaySales, billCount: todayCount },
      month: { totalSales: month.totalSales, billCount: month.billCount },
      receivables: { totalPending: receivables.totalPending, pendingCount: receivables.pendingCount },
      topBuyerToday: topToday ? { name: topToday._id, amount: topToday.totalAmount, bills: topToday.billCount } : null,
      topBuyerMonth: topMonth ? { name: topMonth._id, amount: topMonth.totalAmount, bills: topMonth.billCount } : null,
      whatsappMessage: msg,
      date: dateStr,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/dashboard/analytics
 * Visual chart analytics: 7-day revenue, 6-month trends, customer breakdown (Admin only)
 */
router.get('/analytics', protect, restrictTo('admin'), async (req, res) => {
  try {
    const now = new Date();

    // 1. Last 7 days trend
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [dailyAgg, monthlyAgg, topCustomersAgg, paymentRatioAgg] = await Promise.all([
      // 7-day daily aggregation
      Bill.aggregate([
        {
          $match: {
            date: { $gte: sevenDaysAgo },
            isVoided: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' },
            },
            revenue: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 6-month trend
      Bill.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
            },
            isVoided: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$date' },
            },
            revenue: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top 5 customers
      Bill.aggregate([
        { $match: { isVoided: { $ne: true } } },
        {
          $group: {
            _id: '$companyName',
            total: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),

      // Payment status breakdown
      Bill.aggregate([
        { $match: { isVoided: { $ne: true } } },
        {
          $group: {
            _id: '$paymentStatus',
            total: { $sum: { $ifNull: ['$grandTotal', '$total'] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Format 7-day data with all 7 days guaranteed
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const found = dailyAgg.find((item) => item._id === key);
      last7Days.push({
        date: key,
        label: dayLabel,
        revenue: found ? found.revenue : 0,
        count: found ? found.count : 0,
      });
    }

    // Format 6-month data
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const found = monthlyAgg.find((item) => item._id === key);
      last6Months.push({
        month: key,
        label: monthLabel,
        revenue: found ? found.revenue : 0,
        count: found ? found.count : 0,
      });
    }

    res.json({
      dailyTrends: last7Days,
      monthlyTrends: last6Months,
      topCustomers: topCustomersAgg.map((c) => ({ name: c._id, revenue: c.total, bills: c.count })),
      paymentRatio: paymentRatioAgg,
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

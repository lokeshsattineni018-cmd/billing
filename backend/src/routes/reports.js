const express = require('express');
const Bill = require('../models/Bill');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Helper to calculate date range
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
    start = new Date(now.setDate(diff));
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
 * Comprehensive sales analytics report (Admin only)
 */
router.get('/sales', protect, restrictTo('admin'), async (req, res) => {
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

    let waMessage = `🏢 *VIJAYA DURGA AGENCIES*\n📊 *SALES ANALYTICS REPORT (${rangeLabel})*\n📅 ${dateStr}\n`;
    waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    waMessage += `💰 *Gross Revenue:* ${fmt(totalRevenue)}\n`;
    waMessage += `🧾 *Total Invoices:* ${bills.length}\n`;
    waMessage += `📈 *Average Invoice:* ${fmt(avgTicketSize)}\n`;
    waMessage += `✅ *Paid Collected:* ${fmt(paidData.totalAmount)} (${paidData.count} bills)\n`;
    waMessage += `⚠️ *Pending Collection:* ${fmt(pendingData.totalAmount)} (${pendingData.count} bills)\n`;
    if (totalTax > 0) {
      waMessage += `🏛️ *Total GST Tax:* ${fmt(totalTax)}\n`;
    }
    waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    if (topBuyers.length > 0) {
      waMessage += `🏆 *Top Buyers:*\n`;
      topBuyers.slice(0, 5).forEach((tb, i) => {
        waMessage += `${i + 1}. *${tb._id}* — ${fmt(tb.totalSales)} (${tb.billCount} bills)\n`;
      });
      waMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    }
    waMessage += `_Generated by Vijaya Durga Agencies Admin Suite_`;

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
      topBuyers,
      itemsBreakdown: itemsAgg,
      dateRange: { start, end, label: rangeLabel },
      whatsappSummary: waMessage,
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

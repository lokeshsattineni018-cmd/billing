const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/activity-logs
 * Fetch system audit trail with filtering and pagination (Admin only)
 */
router.get('/', protect, restrictTo('admin', 'owner'), async (req, res) => {
  try {
    const { action, userRole, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (userRole) filter.userRole = userRole;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(100, parseInt(limit, 10) || 50);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

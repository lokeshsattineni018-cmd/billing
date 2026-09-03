const express = require('express');
const Bill = require('../models/Bill');
const Settings = require('../models/Settings');
const { protect, restrictTo } = require('../middleware/auth');
const { sendDailySummaryEmail } = require('../services/emailService');

const router = express.Router();

/**
 * GET /api/backup/daily-summary
 * Generate and email daily summary for previous day (or ?date=YYYY-MM-DD)
 * Can be triggered manually or by external cron (cron-job.org)
 */
router.get('/daily-summary', async (req, res) => {
  try {
    // Support cron secret key for unauthenticated cron triggers
    const cronSecret = req.query.secret || req.headers['x-cron-secret'];
    const isAuthorizedCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!isAuthorizedCron) {
      // Fall back to JWT auth
      return res.status(401).json({ message: 'Unauthorized. Provide ?secret=<CRON_SECRET> or JWT token.' });
    }

    const settings = await Settings.findOne().lean();
    const backupEmail = settings?.backupEmail || process.env.BACKUP_EMAIL;

    if (!backupEmail) {
      return res.status(400).json({ message: 'No backup email configured. Set it in Settings or BACKUP_EMAIL env var.' });
    }

    // Default to yesterday
    const targetDate = req.query.date ? new Date(req.query.date) : new Date(Date.now() - 86400000);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const bills = await Bill.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ billNo: 1 }).lean();

    const totalRevenue = bills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);
    const pendingBills = bills.filter((b) => b.paymentStatus !== 'Paid');
    const pendingAmount = pendingBills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);

    const summary = {
      totalBills: bills.length,
      totalRevenue,
      pendingAmount,
      paidCount: bills.length - pendingBills.length,
      pendingCount: pendingBills.length,
    };

    await sendDailySummaryEmail({ recipientEmail: backupEmail, date: targetDate, bills, summary, settings });

    res.json({
      message: `Daily summary emailed to ${backupEmail}`,
      summary,
      billCount: bills.length,
    });
  } catch (error) {
    console.error('Daily backup error:', error);
    res.status(500).json({ message: 'Failed to send daily summary', error: error.message });
  }
});

/**
 * POST /api/backup/send-now
 * Manual trigger from Settings page (Admin/Owner only)
 */
router.post('/send-now', protect, restrictTo('admin', 'owner'), async (req, res) => {
  try {
    const settings = await Settings.findOne().lean();
    const backupEmail = req.body.email || settings?.backupEmail || process.env.BACKUP_EMAIL;

    if (!backupEmail) {
      return res.status(400).json({ message: 'No backup email provided.' });
    }

    // Send for yesterday by default, or specified date
    const targetDate = req.body.date ? new Date(req.body.date) : new Date(Date.now() - 86400000);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const bills = await Bill.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ billNo: 1 }).lean();

    const totalRevenue = bills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);
    const pendingBills = bills.filter((b) => b.paymentStatus !== 'Paid');
    const pendingAmount = pendingBills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);

    const summary = {
      totalBills: bills.length,
      totalRevenue,
      pendingAmount,
      paidCount: bills.length - pendingBills.length,
      pendingCount: pendingBills.length,
    };

    await sendDailySummaryEmail({ recipientEmail: backupEmail, date: targetDate, bills, summary, settings });

    // Save backup email to settings if not already set
    if (!settings?.backupEmail && backupEmail) {
      await Settings.findOneAndUpdate({}, { backupEmail }, { upsert: true });
    }

    res.json({
      message: `Summary emailed to ${backupEmail}`,
      summary,
      billCount: bills.length,
    });
  } catch (error) {
    console.error('Manual backup error:', error);
    res.status(500).json({ message: 'Failed to send summary email', error: error.message });
  }
});

module.exports = router;

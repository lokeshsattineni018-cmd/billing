const express = require('express');
const Settings = require('../models/Settings');
const { protect, restrictTo } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

const DEFAULT_SETTINGS = {
  businessName: 'VIJAYA DURGA AGENCIES',
  legalName: 'SATTINENI VENKATA DHANA LAXMI',
  address: 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
  phone: '9441429745',
  gstin: '37KATPS1500Q1ZR',
  bankName: 'KARUR VYSYA BANK',
  accountNo: '4805135000002964',
  ifsc: 'KVBL0004815',
  branch: 'Narasapur',
};

/**
 * GET /api/settings
 * Get business settings (creates default if none exist)
 */
router.get('/', protect, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(DEFAULT_SETTINGS);
    }
    // Never expose smtpPass to frontend
    const data = settings.toObject();
    data.smtpConfigured = !!(data.smtpPass && data.smtpPass.length > 0);
    delete data.smtpPass;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const { Counter, resetSequence } = require('../models/Counter');

/**
 * PUT /api/settings
 * Update business settings (Admin only)
 */
router.put('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { businessName, legalName, address, phone, gstin, bankName, accountNo, ifsc, branch, backupEmail, backupEnabled, smtpUser, smtpPass, smtpHost, smtpPort, invoicePrefix } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (businessName !== undefined) settings.businessName = businessName;
    if (legalName !== undefined) settings.legalName = legalName;
    if (address !== undefined) settings.address = address;
    if (phone !== undefined) settings.phone = phone;
    if (gstin !== undefined) settings.gstin = gstin;
    if (bankName !== undefined) settings.bankName = bankName;
    if (accountNo !== undefined) settings.accountNo = accountNo;
    if (ifsc !== undefined) settings.ifsc = ifsc;
    if (branch !== undefined) settings.branch = branch;
    if (backupEmail !== undefined) settings.backupEmail = backupEmail;
    if (backupEnabled !== undefined) settings.backupEnabled = backupEnabled;
    if (smtpUser !== undefined) settings.smtpUser = smtpUser;
    if (smtpPass && smtpPass.trim().length > 0) settings.smtpPass = smtpPass.trim();
    if (smtpHost !== undefined) settings.smtpHost = smtpHost;
    if (smtpPort !== undefined) settings.smtpPort = smtpPort;
    if (invoicePrefix !== undefined) settings.invoicePrefix = invoicePrefix.trim();

    await settings.save();
    // Never expose smtpPass to frontend
    const data = settings.toObject();
    data.smtpConfigured = !!(data.smtpPass && data.smtpPass.length > 0);
    delete data.smtpPass;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/settings/counter-status
 * Get current invoice counter status (Admin only)
 */
router.get('/counter-status', protect, restrictTo('admin'), async (req, res) => {
  try {
    const counter = await Counter.findOne({ _id: 'billNo' });
    const currentNumber = counter ? counter.seq : 0;
    res.json({
      currentNumber,
      nextNumber: currentNumber + 1,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/settings/reset-counter
 * Reset or set the next invoice sequence number (Admin only)
 */
router.post('/reset-counter', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { nextNumber } = req.body;
    const targetNum = parseInt(nextNumber, 10);

    if (isNaN(targetNum) || targetNum < 1) {
      return res.status(400).json({ message: 'Next invoice number must be an integer greater than or equal to 1.' });
    }

    const counter = await Counter.findOne({ _id: 'billNo' });
    const previous = counter ? counter.seq : 0;

    // Setting seq to (targetNum - 1) means next call to getNextSequence() will produce targetNum
    const newSeq = targetNum - 1;
    await resetSequence('billNo', newSeq);

    await logActivity(req, 'RESET_COUNTER', 'billNo', {
      previousNextNo: previous + 1,
      newNextNo: targetNum,
    });

    res.json({
      message: `Invoice sequence updated successfully. Next invoice will be #${targetNum}.`,
      currentNumber: newSeq,
      nextNumber: targetNum,
    });
  } catch (error) {
    console.error('Reset counter error:', error);
    res.status(500).json({ message: 'Failed to reset invoice counter', error: error.message });
  }
});

module.exports = router;

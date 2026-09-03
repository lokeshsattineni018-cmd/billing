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
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/settings
 * Update business settings (Admin only)
 */
router.put('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { businessName, legalName, address, phone, gstin, bankName, accountNo, ifsc, branch, backupEmail, backupEnabled, smtpUser, smtpPass, smtpHost, smtpPort } = req.body;

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
    if (smtpPass !== undefined) settings.smtpPass = smtpPass;
    if (smtpHost !== undefined) settings.smtpHost = smtpHost;
    if (smtpPort !== undefined) settings.smtpPort = smtpPort;

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

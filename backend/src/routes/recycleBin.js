const express = require('express');
const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const DailyIce = require('../models/DailyIce');
const DailyWastage = require('../models/DailyWastage');
const StaffWork = require('../models/StaffWork');
const { Counter, resetSequence, getNextSequence } = require('../models/Counter');
const { protect, restrictTo } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const structuredLogger = require('../utils/structuredLogger');
const { handleServerError } = require('../utils/errorTracker');

const router = express.Router();

// All recycle bin routes are Admin & Owner only
router.use(protect, restrictTo('owner', 'admin'));

/**
 * GET /api/recycle-bin
 * List all soft-deleted records across Invoices, Ice, Wastage, and Worker Attendance
 */
router.get('/', async (req, res) => {
  try {
    const { type = 'all', page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const results = {
      bills: [],
      ice: [],
      wastage: [],
      staff: [],
      counts: { bills: 0, ice: 0, wastage: 0, staff: 0, total: 0 },
    };

    const [
      deletedBills,
      billsCount,
      deletedIce,
      iceCount,
      deletedWastage,
      wastageCount,
      deletedStaff,
      staffCount,
    ] = await Promise.all([
      type === 'all' || type === 'bills'
        ? Bill.find({ isDeleted: true })
            .populate('deletedBy', 'name')
            .sort({ deletedAt: -1, updatedAt: -1 })
            .skip(type === 'bills' ? skip : 0)
            .limit(type === 'bills' ? limitNum : 50)
            .lean()
        : [],
      Bill.countDocuments({ isDeleted: true }),

      type === 'all' || type === 'ice'
        ? DailyIce.find({ isDeleted: true })
            .populate('deletedBy', 'name')
            .sort({ deletedAt: -1, updatedAt: -1 })
            .skip(type === 'ice' ? skip : 0)
            .limit(type === 'ice' ? limitNum : 50)
            .lean()
        : [],
      DailyIce.countDocuments({ isDeleted: true }),

      type === 'all' || type === 'wastage'
        ? DailyWastage.find({ isDeleted: true })
            .populate('deletedBy', 'name')
            .sort({ deletedAt: -1, updatedAt: -1 })
            .skip(type === 'wastage' ? skip : 0)
            .limit(type === 'wastage' ? limitNum : 50)
            .lean()
        : [],
      DailyWastage.countDocuments({ isDeleted: true }),

      type === 'all' || type === 'staff'
        ? StaffWork.find({ isDeleted: true })
            .populate('deletedBy', 'name')
            .sort({ deletedAt: -1, updatedAt: -1 })
            .skip(type === 'staff' ? skip : 0)
            .limit(type === 'staff' ? limitNum : 50)
            .lean()
        : [],
      StaffWork.countDocuments({ isDeleted: true }),
    ]);

    results.bills = deletedBills;
    results.ice = deletedIce;
    results.wastage = deletedWastage;
    results.staff = deletedStaff;
    results.counts = {
      bills: billsCount,
      ice: iceCount,
      wastage: wastageCount,
      staff: staffCount,
      total: billsCount + iceCount + wastageCount + staffCount,
    };

    res.json(results);
  } catch (error) {
    console.error('Recycle Bin list error:', error);
    return handleServerError(res, error, 'Failed to fetch deleted records', req);
  }
});

/**
 * POST /api/recycle-bin/restore/bill/:id
 * Restore a deleted invoice back to active invoices
 */
router.post('/restore/bill/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Invoice record not found' });
    }

    if (!bill.isDeleted) {
      return res.status(400).json({ message: 'Invoice is already active and not deleted' });
    }

    const targetBillNo = bill.originalBillNo || Math.abs(bill.billNo);

    // Check if the original bill number is already taken by a newly created active bill
    const activeWithSameNo = await Bill.findOne({
      billNo: targetBillNo,
      isDeleted: { $ne: true },
    }).lean();

    let restoredBillNo = targetBillNo;
    let numberChanged = false;

    if (activeWithSameNo) {
      // Allocate the next available sequential number
      restoredBillNo = await getNextSequence('billNo');
      numberChanged = true;
    }

    bill.billNo = restoredBillNo;
    bill.isDeleted = false;
    bill.deletedAt = undefined;
    bill.deletedBy = undefined;
    bill.deletedReason = undefined;

    // Update formattedBillNo if number changed
    if (numberChanged) {
      const prefix = bill.formattedBillNo?.replace(/\d+$/, '') || 'VDA/';
      bill.formattedBillNo = `${prefix}${String(restoredBillNo).padStart(4, '0')}`;
    }

    await bill.save();

    // Ensure counter sequence is at least equal to restoredBillNo
    const currentCounter = await Counter.findOne({ _id: 'billNo' }).lean();
    if (!currentCounter || currentCounter.seq < restoredBillNo) {
      await resetSequence('billNo', restoredBillNo);
    }

    await logActivity(req, 'RESTORE_BILL', String(restoredBillNo), {
      originalBillNo: targetBillNo,
      restoredBillNo,
      numberChanged,
      customer: bill.companyName,
    });
    structuredLogger.logBillOperation('RESTORE', bill, req, {
      restoredBillNo,
      originalBillNo: targetBillNo,
      numberChanged,
    });

    res.json({
      success: true,
      message: numberChanged
        ? `Invoice restored successfully as #${restoredBillNo} (Original #${targetBillNo} was already re-assigned).`
        : `Invoice #${restoredBillNo} restored to active bills successfully.`,
      bill,
    });
  } catch (error) {
    console.error('Restore bill error:', error);
    return handleServerError(res, error, 'Failed to restore invoice', req);
  }
});

/**
 * POST /api/recycle-bin/restore/ice/:id
 * Restore deleted daily ice record
 */
router.post('/restore/ice/:id', async (req, res) => {
  try {
    const record = await DailyIce.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ice record not found' });
    }

    record.isDeleted = false;
    record.deletedAt = undefined;
    record.deletedBy = undefined;
    record.deletedReason = undefined;
    await record.save();

    await logActivity(req, 'ICE_RESTORED', req.params.id, {
      blocks: record.blocks,
      totalAmount: record.totalAmount,
    });

    res.json({ success: true, message: 'Ice record restored successfully', record });
  } catch (error) {
    console.error('Restore ice error:', error);
    return handleServerError(res, error, 'Failed to restore ice record', req);
  }
});

/**
 * POST /api/recycle-bin/restore/wastage/:id
 * Restore deleted wastage sales record
 */
router.post('/restore/wastage/:id', async (req, res) => {
  try {
    const record = await DailyWastage.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Wastage record not found' });
    }

    record.isDeleted = false;
    record.deletedAt = undefined;
    record.deletedBy = undefined;
    record.deletedReason = undefined;
    await record.save();

    await logActivity(req, 'WASTAGE_RESTORED', req.params.id, {
      quantityKg: record.quantityKg,
      totalAmount: record.totalAmount,
    });

    res.json({ success: true, message: 'Wastage sales record restored successfully', record });
  } catch (error) {
    console.error('Restore wastage error:', error);
    return handleServerError(res, error, 'Failed to restore wastage record', req);
  }
});

/**
 * POST /api/recycle-bin/restore/staff/:id
 * Restore deleted staff worker attendance entry
 */
router.post('/restore/staff/:id', async (req, res) => {
  try {
    const entry = await StaffWork.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Staff work entry not found' });
    }

    entry.isDeleted = false;
    entry.deletedAt = undefined;
    entry.deletedBy = undefined;
    entry.deletedReason = undefined;
    await entry.save();

    await logActivity(req, 'STAFF_WORK_RESTORED', req.params.id, {
      staffName: entry.staffName,
      totalAmount: entry.totalAmount,
    });

    res.json({ success: true, message: `Worker record for ${entry.staffName} restored successfully`, entry });
  } catch (error) {
    console.error('Restore staff work error:', error);
    return handleServerError(res, error, 'Failed to restore staff work entry', req);
  }
});

module.exports = router;


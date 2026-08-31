const ActivityLog = require('../models/ActivityLog');

/**
 * Log a user action to the database asynchronously
 */
const logActivity = async (req, action, targetId = '', details = {}) => {
  try {
    if (!req || !req.user) return;

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    await ActivityLog.create({
      user: req.user._id,
      userName: req.user.name || 'Unknown User',
      userRole: req.user.role || 'staff',
      action,
      targetId: String(targetId || ''),
      details,
      ip: String(ip).split(',')[0].trim(),
    });
  } catch (error) {
    console.error('Failed to record activity log:', error.message);
  }
};

module.exports = { logActivity };

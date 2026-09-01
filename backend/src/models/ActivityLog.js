const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userRole: {
    type: String,
    enum: ['admin', 'owner', 'staff'],
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE_BILL',
      'EDIT_BILL',
      'VOID_BILL',
      'UPDATE_PAYMENT_STATUS',
      'SET_CREDIT_LIMIT',
      'UPDATE_SETTINGS',
      'EXPORT_CSV',
      'EXPORT_TALLY',
      'SEND_REMINDER',
      'CREATE_USER',
      'DELETE_USER',
      'UPDATE_USER',
      'RESET_PASSWORD',
    ],
  },
  targetId: {
    type: String,
    default: '',
  },
  targetType: {
    type: String,
    default: 'BILL',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ip: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

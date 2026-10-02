const mongoose = require('mongoose');

const dailyIceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
      index: true,
    },
    blocks: {
      type: Number,
      required: [true, 'Number of ice blocks used is required'],
      min: [0, 'Blocks cannot be negative'],
    },
    rate: {
      type: Number,
      required: [true, 'Rate per ice block is required'],
      min: [0, 'Rate cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleNo: {
      type: String,
      trim: true,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending'],
      default: 'Paid',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Auto calculate totalAmount before saving if not provided
dailyIceSchema.pre('validate', function () {
  if (this.blocks !== undefined && this.rate !== undefined) {
    this.totalAmount = Math.round(this.blocks * this.rate * 100) / 100;
  }
});

dailyIceSchema.index({ date: -1, createdAt: -1 });

module.exports = mongoose.model('DailyIce', dailyIceSchema);

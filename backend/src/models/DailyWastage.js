const mongoose = require('mongoose');

const dailyWastageSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'Prawn Head',
    },
    quantityKg: {
      type: Number,
      required: [true, 'Prawn head wastage quantity in KG is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    rate: {
      type: Number,
      required: [true, 'Rate per KG is required'],
      min: [0, 'Rate cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    buyerName: {
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
dailyWastageSchema.pre('validate', function () {
  if (this.quantityKg !== undefined && this.rate !== undefined) {
    this.totalAmount = Math.round(this.quantityKg * this.rate * 100) / 100;
  }
});

dailyWastageSchema.index({ date: -1, createdAt: -1 });

module.exports = mongoose.model('DailyWastage', dailyWastageSchema);

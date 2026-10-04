const mongoose = require('mongoose');

const staffWorkSchema = new mongoose.Schema(
  {
    voucherNo: {
      type: String,
      trim: true,
      default: '',
    },
    staffName: {
      type: String,
      required: [true, 'Staff / worker name is required'],
      trim: true,
      index: true,
    },
    staffPhone: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity in KG is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    price: {
      type: Number,
      required: [true, 'Price per KG is required'],
      min: [0, 'Price cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    workType: {
      type: String,
      default: 'Peeling / Seafood Processing',
      trim: true,
    },
    shift: {
      type: String,
      enum: ['Full Day', 'Morning', 'Evening', 'Night'],
      default: 'Full Day',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partial'],
      default: 'Pending',
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    paymentDate: {
      type: Date,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Other', ''],
      default: 'Cash',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    recordedByName: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Ensure totalAmount is accurately calculated
staffWorkSchema.pre('validate', function (next) {
  if (this.quantity != null && this.price != null) {
    this.totalAmount = Math.round(Number(this.quantity) * Number(this.price) * 100) / 100;
  }
  if (this.paymentStatus === 'Paid' && (!this.amountPaid || this.amountPaid === 0)) {
    this.amountPaid = this.totalAmount;
    if (!this.paymentDate) this.paymentDate = new Date();
  }
  next();
});

// Index for high-performance aggregate queries (group by staffName, date sorting)
staffWorkSchema.index({ date: -1, staffName: 1 });
staffWorkSchema.index({ staffName: 1, paymentStatus: 1 });

const StaffWork = mongoose.model('StaffWork', staffWorkSchema);

module.exports = StaffWork;

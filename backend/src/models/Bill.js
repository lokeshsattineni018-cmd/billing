const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema({
  sno: { type: Number, default: 1 },
  particulars: { type: String, default: 'Fresh Seafood / Prawns Supply' },
  hsn: { type: String, default: '0306' },
  quantity: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  taxRate: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const billSchema = new mongoose.Schema({
  billNo: {
    type: Number,
    unique: true,
    required: true,
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    default: () => crypto.randomBytes(16).toString('hex'), // 128-bit unguessable random token
  },
  date: {
    type: Date,
    default: Date.now,
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  companyGstin: {
    type: String,
    trim: true,
    required: [true, 'GSTIN is required'],
  },
  customerPhone: {
    type: String,
    trim: true,
    default: '',
  },
  particulars: {
    type: String,
    default: 'Fresh Seafood / Prawns Supply',
  },
  hsn: {
    type: String,
    default: '0306',
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 0,
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: 0,
  },
  items: [itemSchema],
  taxableValue: {
    type: Number,
    default: 0,
  },
  cgstRate: { type: String, default: '' },
  cgstAmount: { type: Number, default: 0 },
  sgstRate: { type: String, default: '' },
  sgstAmount: { type: Number, default: 0 },
  igstRate: { type: String, default: '' },
  igstAmount: { type: Number, default: 0 },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  grandTotal: {
    type: Number,
    default: 0,
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid'],
    default: 'Pending',
  },
  payments: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      mode: { type: String, enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'], default: 'Cash' },
      reference: { type: String, default: '', trim: true },
      notes: { type: String, default: '', trim: true },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
  isVoided: {
    type: Boolean,
    default: false,
  },
  voidReason: {
    type: String,
    default: '',
    trim: true,
  },
  voidedAt: {
    type: Date,
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes for high-performance search and filtering
billSchema.index({ companyName: 'text' });
billSchema.index({ date: -1 });
billSchema.index({ billNo: -1 });
billSchema.index({ isVoided: 1 });
billSchema.index({ isVoided: 1, date: -1, billNo: -1 });
billSchema.index({ companyName: 1, isVoided: 1, date: -1 });
billSchema.index({ paymentStatus: 1, isVoided: 1, date: -1 });

module.exports = mongoose.model('Bill', billSchema);

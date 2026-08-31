const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    unique: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  gstin: {
    type: String,
    trim: true,
    default: '',
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
  creditLimit: {
    type: Number,
    default: 0, // 0 means no credit limit set
    min: 0,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

customerSchema.index({ phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);

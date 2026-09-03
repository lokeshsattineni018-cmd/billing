const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  businessName: {
    type: String,
    default: 'VIJAYA DURGA AGENCIES',
  },
  legalName: {
    type: String,
    default: 'SATTINENI VENKATA DHANA LAXMI',
  },
  address: {
    type: String,
    default: 'D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.',
  },
  phone: {
    type: String,
    default: '9441429745',
  },
  gstin: {
    type: String,
    default: '37KATPS1500Q1ZR',
  },
  bankName: {
    type: String,
    default: 'KARUR VYSYA BANK',
  },
  accountNo: {
    type: String,
    default: '4805135000002964',
  },
  ifsc: {
    type: String,
    default: 'KVBL0004815',
  },
  branch: {
    type: String,
    default: 'Narasapur',
  },
  backupEmail: {
    type: String,
    default: '',
  },
  backupEnabled: {
    type: Boolean,
    default: false,
  },
  smtpUser: {
    type: String,
    default: '',
  },
  smtpPass: {
    type: String,
    default: '',
  },
  smtpHost: {
    type: String,
    default: 'smtp.gmail.com',
  },
  smtpPort: {
    type: Number,
    default: 587,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Settings', settingsSchema);

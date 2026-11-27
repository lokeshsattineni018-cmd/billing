const mongoose = require('mongoose');
const { encryptText } = require('../utils/crypto');
const { CANONICAL_BANK_DETAILS } = require('../constants/bankDetails');

const settingsSchema = new mongoose.Schema({
  businessName: {
    type: String,
    default: 'VIJAYA DURGA SEA FOODS',
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
    default: CANONICAL_BANK_DETAILS.bankName,
  },
  accountNo: {
    type: String,
    default: CANONICAL_BANK_DETAILS.accountNo,
  },
  ifsc: {
    type: String,
    default: CANONICAL_BANK_DETAILS.ifsc,
  },
  branch: {
    type: String,
    default: CANONICAL_BANK_DETAILS.branch,
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
    set: (val) => (val ? encryptText(val) : ''),
  },
  smtpHost: {
    type: String,
    default: 'smtp.gmail.com',
  },
  smtpPort: {
    type: Number,
    default: 587,
  },
  invoicePrefix: {
    type: String,
    default: 'VDA/',
  },
  backupScheduleTime: {
    type: String,
    default: '21:00',
  },
  pushNotificationsEnabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

/**
 * One-time transparent migration:
 * If an existing settings document in MongoDB contains unencrypted plaintext smtpPass,
 * encrypt it immediately at rest and persist.
 */
settingsSchema.statics.ensureSmtpEncrypted = async function (settingsDoc) {
  if (settingsDoc && settingsDoc.smtpPass && !settingsDoc.smtpPass.startsWith('enc:v1:')) {
    const rawPlaintext = settingsDoc.smtpPass;
    settingsDoc.smtpPass = encryptText(rawPlaintext);
    await settingsDoc.save();
  }
  return settingsDoc;
};

module.exports = mongoose.model('Settings', settingsSchema);

const mongoose = require('mongoose');

const consumedNonceSchema = new mongoose.Schema(
  {
    nonce: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 120, // TTL index: MongoDB automatically deletes document 120s after creation
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const ConsumedNonce = mongoose.models.ConsumedNonce || mongoose.model('ConsumedNonce', consumedNonceSchema);

module.exports = ConsumedNonce;

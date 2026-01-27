const mongoose = require('mongoose');

const smsHistorySchema = new mongoose.Schema({
  sentTo: [{ type: String }], // mobile numbers
  content: { type: String, required: true },
  date: { type: Date, default: Date.now },
   // New fields for subadmin feature
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('SmsHistory', smsHistorySchema);
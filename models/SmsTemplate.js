const mongoose = require('mongoose');

const smsTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
   // New fields for subadmin feature
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('SmsTemplate', smsTemplateSchema);
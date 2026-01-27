// models/Billing.js
const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank'], default: 'cash' },
  paidAmount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'flat', null], default: null },
  discountValue: { type: Number, default: 0 },
  taxApplicable: { type: Boolean, default: false },
  taxAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  billDate: { type: Date, default: Date.now },
  remarks: { type: String, default: '' }, // optional
  status: { type: String, enum: ['paid', 'partial', 'pending', 'overdue'], default: 'pending' },
   // New fields for subadmin feature
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Billing', billingSchema);
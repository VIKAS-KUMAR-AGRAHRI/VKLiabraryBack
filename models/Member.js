const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  memberId: {
    type: String,
    required: true,
    trim: true,
  },
  name: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: { type: String, required: true },
  address: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  dob: { type: Date },
  fatherName: { type: String },
  uniqueId: { type: String, sparse: true },
  institute: { type: String },
  course: { type: String },
  homePhone: { type: String },
  documents: [{ type: String }],

  // Batch timing
  batchStart: { type: String },
  batchEnd: { type: String },

  remarks: { type: String },

  status: {
    type: String,
    enum: ['active', 'blocked', 'left', 'freeze'],
    default: 'active'
  },

  currentPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  planStartDate: { type: Date },
  planExpiryDate: { type: Date },
  membershipStatus: {
    type: String,
    enum: ['active', 'expired', 'pending', 'cancelled'],
    default: 'pending'
  },

  lastPlanAmount: { type: Number },
  lastEnrollmentFee: { type: Number },
  lastPaidAmount: { type: Number },
  lastDueAmount: { type: Number },

  seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', default: null },

  // New fields for subadmin feature
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ──────────────────────────────────────────────
  // FREEZE FEATURE – Open-ended freeze until unfreeze
  // ──────────────────────────────────────────────
  freezeStartDate: { 
    type: Date, 
    default: null 
  }, // Start date of current freeze (null when not frozen)
freezeHistory: [{
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    // required: false  ← Remove required
  },
  days: {
    type: Number,
    min: 1
    // required: false  ← Remove required
  },
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  unfrozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: false  ← Remove required
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 200
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}],

}, { timestamps: true });

// Compound unique index for memberId per rootAdmin
memberSchema.index({ memberId: 1, rootAdmin: 1 }, { unique: true });

// Virtual: days until expiry
memberSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.planExpiryDate) return null;
  const now = new Date();
  const diff = this.planExpiryDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Member', memberSchema);
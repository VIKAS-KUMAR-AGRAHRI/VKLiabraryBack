// models/Seat.js
const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'full_day'],
      required: true,
    },
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    reserved: {
      type: Boolean,
      default: false,
    },
    // Optional: status field if you want more states later
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
    },
     // New fields for subadmin feature
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Compound index – prevent duplicate seat numbers per floor
seatSchema.index({ floor: 1, number: 1 }, { unique: true });

// Virtual for convenience
seatSchema.virtual('isOccupied').get(function () {
  return !!this.assignedTo;
});

module.exports = mongoose.model('Seat', seatSchema);
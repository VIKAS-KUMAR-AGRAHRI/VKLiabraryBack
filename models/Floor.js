// models/Floor.js
const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Floor name is required'],
      trim: true,
      unique: true,           // prevent duplicate floor names
    },
    description: {
      type: String,
      trim: true,
    },
    // Optional: if you want to track total capacity or something
    capacity: {
      type: Number,
      default: 0,
    },
    // You can add more fields later (building, wing, etc.)
     // New fields for subadmin feature
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Virtual – number of seats on this floor (useful for stats)
floorSchema.virtual('seatCount', {
  ref: 'Seat',
  localField: '_id',
  foreignField: 'floor',
  count: true, // only count, no data loading
});

module.exports = mongoose.model('Floor', floorSchema);
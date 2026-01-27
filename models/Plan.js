const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type:{type:String,required:true},
  duration: { type: Number, required: true }, 
  amount: { type: Number, required: true },
  enrollmentFee: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
   // New fields for subadmin feature
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rootAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);


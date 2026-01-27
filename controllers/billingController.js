const Billing = require('../models/Billing');
const Plan = require('../models/Plan');
const Member = require('../models/Member');
const Joi = require('joi');
const { isValidObjectId } = require('mongoose');

// Helper to determine root admin
const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

const billingSchema = Joi.object({
  member: Joi.string().required(),
  plan: Joi.string().required(),
  startDate: Joi.date().required(),
  paymentMethod: Joi.string().valid('cash', 'upi', 'card', 'bank'),
  paidAmount: Joi.number().min(0).default(0),
  discountType: Joi.string().valid('percentage', 'flat').allow(null),
  discountValue: Joi.number().min(0).default(0),
  taxApplicable: Joi.boolean().default(false),
  taxAmount: Joi.number().min(0).default(0),
  remarks: Joi.string().allow(''),
});

exports.createBilling = async (req, res) => {
  console.log("billing controller hit success");
  const { error } = billingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const rootAdminId = getRootAdminId(user);

    const { 
      member, plan, startDate, paidAmount = 0, 
      discountType, discountValue = 0, 
      taxApplicable = false, taxAmount = 0, remarks,
      paymentMethod 
    } = req.body;

    // Validate member & plan exist + belong to this rootAdmin
    const memberDoc = await Member.findOne({ 
      _id: member, 
      rootAdmin: rootAdminId 
    });
    if (!memberDoc) return res.status(404).json({ message: 'Member not found or unauthorized' });

    const planDoc = await Plan.findOne({ 
      _id: plan, 
      rootAdmin: rootAdminId 
    });
    if (!planDoc) return res.status(404).json({ message: 'Plan not found or unauthorized' });
    if (!planDoc.enabled) return res.status(400).json({ message: 'This plan is currently disabled' });

    // Calculate endDate
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + planDoc.duration);

    // Calculate totals
    const baseAmount = planDoc.amount;
    const enrollment = planDoc.enrollmentFee || 0;
    const totalBeforeDiscount = baseAmount + enrollment;

    let discount = 0;
    if (discountType === 'percentage') {
      discount = (totalBeforeDiscount * discountValue) / 100;
    } else if (discountType === 'flat') {
      discount = discountValue;
    }

    const finalTax = taxApplicable ? (taxAmount || 0) : 0;
    const totalPayable = totalBeforeDiscount - discount + finalTax;
    const due = totalPayable - paidAmount;

    const billing = new Billing({
      member,
      plan,
      startDate,
      endDate: end,
      paymentMethod: paymentMethod || 'cash',
      paidAmount: Number(paidAmount),
      discountType,
      discountValue,
      taxApplicable,
      taxAmount: finalTax,
      dueAmount: due,
      remarks,
      status: due > 0 ? (paidAmount > 0 ? 'partial' : 'pending') : 'paid',

      // ── IMPORTANT: Ownership fields ──
      createdBy: user._id,
      rootAdmin: rootAdminId,
    });

    await billing.save();

    // Update member fields
    const updatedMember = await Member.findByIdAndUpdate(
      member,
      {
        status: 'active',
        currentPlan: plan,
        planStartDate: startDate,
        planExpiryDate: end,
        membershipStatus: 'active',
        lastPaidAmount: Number(paidAmount),
        lastDueAmount: due,
        lastPlanAmount: baseAmount,
        lastEnrollmentFee: enrollment,
      },
      { new: true, runValidators: true }
    );

    if (!updatedMember) {
      return res.status(500).json({ message: 'Failed to update member status' });
    }

    res.status(201).json({
      success: true,
      data: await billing.populate('member plan'),
      member: updatedMember,
    });
  } catch (err) {
    console.error('Create Billing Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getBillings = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { member, plan } = req.query;

    const filter = { rootAdmin: rootAdminId };
    if (member) filter.member = member;
    if (plan) filter.plan = plan;

    const billings = await Billing.find(filter)
      .populate('member', 'name mobile memberId')
      .populate('plan', 'name amount duration')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: billings.length,
      data: billings,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBillingById = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const billing = await Billing.findOne({ 
      _id: req.params.id,
      rootAdmin: rootAdminId 
    })
      .populate('member', 'name mobile memberId')
      .populate('plan', 'name amount duration');

    if (!billing) return res.status(404).json({ message: 'Billing record not found or unauthorized' });

    res.json({ success: true, data: billing });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMemberBillHistory = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { memberId } = req.params;

    const history = await Billing.find({ 
      member: memberId,
      rootAdmin: rootAdminId 
    })
      .populate('plan', 'name amount duration')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
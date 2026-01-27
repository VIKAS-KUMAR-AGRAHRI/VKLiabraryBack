const Plan = require('../models/Plan');
const Joi = require('joi');

const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

const planSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  duration: Joi.number().required(),
  amount: Joi.number().required(),
  enrollmentFee: Joi.number().min(0),
  enabled: Joi.boolean().default(true),
});

exports.createPlan = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { error } = planSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const plan = new Plan({
      ...req.body,
      createdBy: user._id,
      rootAdmin: rootAdminId,
    });

    await plan.save();
    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.enablePlan = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { enabled: true },
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found or unauthorized' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.disablePlan = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { enabled: false },
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found or unauthorized' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const plans = await Plan.find({ rootAdmin: rootAdminId })
      .sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.editPlan = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!plan) return res.status(404).json({ message: 'Plan not found or unauthorized' });

    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const plan = await Plan.findOneAndDelete({ 
      _id: req.params.id,
      rootAdmin: rootAdminId 
    });

    if (!plan) return res.status(404).json({ message: 'Plan not found or unauthorized' });

    res.json({ message: 'Plan deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
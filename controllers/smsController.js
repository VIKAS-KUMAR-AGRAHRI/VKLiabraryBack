const SmsTemplate = require('../models/SmsTemplate');
const sendSms = require('../utils/sendSms');
const validate = require('../middlewares/validation');
const Joi = require('joi');

const templateSchema = Joi.object({
  name: Joi.string().required(),
  content: Joi.string().required(),
});

exports.createTemplate = [validate(templateSchema), async (req, res) => {
  try {
    const template = new SmsTemplate(req.body);
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}];

exports.sendBulkSms = async (req, res) => {
  const { to, content } = req.body; // to: array of mobiles
  try {
    for (const mobile of to) {
      await sendSms([mobile], content);
    }
    res.json({ msg: 'SMS sent' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getSmsHistory = async (req, res) => {
  try {
    const history = await SmsHistory.find();
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
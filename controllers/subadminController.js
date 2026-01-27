const User = require('../models/User');
const validate = require('../middlewares/validation');
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

exports.addSubadmin = [validate(registerSchema), async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ msg: 'Only admins can add subadmins' });

  const { username, password } = req.body;
  try {
    let subadmin = await User.findOne({ username });
    if (subadmin) return res.status(400).json({ msg: 'User already exists' });

    subadmin = new User({ username, password, role: 'subadmin', adminId: user._id });
    await subadmin.save();

    res.json({ msg: 'Subadmin created', subadmin: { id: subadmin._id, username } });
  } catch (err) {
    console.error('Add Subadmin Error:', err);
    res.status(500).json({ msg: 'Server error', details: err.message });
  }
}];

exports.getMySubadmins = async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ msg: 'Only admins can view subadmins' });

  try {
    const subadmins = await User.find({ role: 'subadmin', adminId: user._id }).select('-password');
    res.json(subadmins);
  } catch (err) {
    console.error('Get Subadmins Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
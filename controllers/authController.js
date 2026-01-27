const User = require('../models/User');
const jwt = require('jsonwebtoken');
const validate = require('../middlewares/validation');
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

exports.register = [validate(registerSchema), async (req, res) => {
  const { username, password } = req.body;
  console.log(username, "and", password);
  try {
    let user = await User.findOne({ username });
    console.log("sjfkj")
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ username, password, role: 'admin' }); // Defaults to admin
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('REGISTER ERROR DETAILS:', err);  // This will show the real error
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.errors) console.error('Validation errors:', err.errors);
    res.status(500).json({ msg: 'Server error', details: err.message }); // optional: send for debug
  }
}];

exports.login = [validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log(username,"and j", password);
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}];

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
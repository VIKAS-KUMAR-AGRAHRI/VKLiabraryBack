const Attendance = require('../models/Attendance');
const validate = require('../middlewares/validation');
const Joi = require('joi');

const attendanceSchema = Joi.object({
  member: Joi.string().required(),
  date: Joi.date().required(),
  present: Joi.boolean(),
});

exports.markAttendance = [validate(attendanceSchema), async (req, res) => {
  try {
    const attendance = new Attendance(req.body);
    await attendance.save();
    res.status(201).json(attendance);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ msg: 'Attendance already marked for this date' });
    res.status(500).json({ msg: 'Server error' });
  }
}];

exports.getAttendanceHistory = async (req, res) => {
  const { member, startDate, endDate } = req.query;
  try {
    const filter = { member };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date.$lte = new Date(endDate);
    const history = await Attendance.find(filter);
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Reports in reportController
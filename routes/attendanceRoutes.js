const express = require('express');
const auth = require('../middlewares/auth');
const { markAttendance, getAttendanceHistory } = require('../controllers/attendanceController');

const router = express.Router();

router.post('/', auth, markAttendance);
router.get('/history', auth, getAttendanceHistory);

module.exports = router;
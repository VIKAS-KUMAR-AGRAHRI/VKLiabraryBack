const express = require('express');
const auth = require('../middlewares/auth');
const { memberReport, collectionReport, seatUtilizationReport, attendanceReport, expensesReport, dueReport, expiryReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/members', auth, memberReport);
router.get('/collections', auth, collectionReport);
router.get('/seats', auth, seatUtilizationReport);
router.get('/attendances', auth, attendanceReport);
router.get('/expenses', auth, expensesReport);
router.get('/dues', auth, dueReport);
router.get('/expiries', auth, expiryReport);

module.exports = router;
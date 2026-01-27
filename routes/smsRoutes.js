const express = require('express');
const auth = require('../middlewares/auth');
const { createTemplate, sendBulkSms, getSmsHistory } = require('../controllers/smsController');

const router = express.Router();

router.post('/templates', auth, createTemplate);
router.post('/bulk', auth, sendBulkSms);
router.get('/history', auth, getSmsHistory);

module.exports = router;
const express = require('express');
const auth = require('../middlewares/auth');
const { getDashboard } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', auth, getDashboard);

module.exports = router;
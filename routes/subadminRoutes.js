const express = require('express');
const auth = require('../middlewares/auth');
const { addSubadmin, getMySubadmins } = require('../controllers/subadminController');

const router = express.Router();

router.post('/', auth, addSubadmin);
router.get('/', auth, getMySubadmins);

module.exports = router;
// routes/billingRoutes.js
const express = require('express');
const auth = require('../middlewares/auth');
const {
  createBilling,
  getBillings,
  getBillingById,
  getMemberBillHistory,
} = require('../controllers/billingController');

const router = express.Router();

router.use(auth);

router.post('/', createBilling);
router.get('/', getBillings);                    // all + ?member= & ?plan=
router.get('/:id', getBillingById);
router.get('/member/:memberId', getMemberBillHistory); // past bills for one member

module.exports = router;
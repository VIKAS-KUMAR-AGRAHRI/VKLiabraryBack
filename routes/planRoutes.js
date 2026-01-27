const express = require('express');
const auth = require('../middlewares/auth');
const { createPlan, enablePlan, disablePlan, getPlans,editPlan,deletePlan } = require('../controllers/planController');

const router = express.Router();

router.post('/', auth, createPlan);
router.put('/:id/enable', auth, enablePlan);
router.put('/:id/disable', auth, disablePlan);
router.get('/', auth, getPlans);
router.put('/:id', auth, editPlan);
router.delete('/:id', auth, deletePlan);

module.exports = router;
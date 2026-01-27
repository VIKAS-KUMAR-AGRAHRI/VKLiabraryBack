const express = require('express');
const auth = require('../middlewares/auth');
const {
  createFloor,
  getAllFloors,
  getFloorById,
  updateFloor,
  deleteFloor,
} = require('../controllers/floorController');

const router = express.Router();

router.use(auth); // all floor routes protected

router.post('/', createFloor);
router.get('/', getAllFloors);
router.get('/:id', getFloorById);
router.put('/:id', updateFloor);
router.delete('/:id', deleteFloor);

module.exports = router;
// routes/seatRoutes.js
const express = require('express');
const auth = require('../middlewares/auth');
const {
  addSeatsBulk,
  getAllSeats,
  getSeatStats,
  deleteSeat,
  assignSeat,
  unassignSeat,
  getSeatsByFloor,
  getSeatById,          // ← NEW CONTROLLER
} = require('../controllers/seatController');

const router = express.Router();

router.use(auth);

router.post('/', addSeatsBulk);
router.get('/', getAllSeats);
router.get('/stats', getSeatStats);
router.get('/:id', getSeatById);           // ← NEW: GET single seat
router.delete('/:id', deleteSeat);
router.put('/:id/assign', assignSeat);
router.put('/:id/unassign', unassignSeat);
router.get('/floor/:floorId', getSeatsByFloor);

module.exports = router;
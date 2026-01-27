const Seat = require('../models/Seat');
const Floor = require('../models/Floor');
const Member = require('../models/Member');

// Helper to determine root admin
const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

// ────────────────────────────────────────────────
// BULK CREATE SEATS
// ────────────────────────────────────────────────
exports.addSeatsBulk = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const rootAdminId = getRootAdminId(user);

    const { floor, type, count, startNumber = 1, prefix = '' } = req.body;

    if (!floor || !type || !count || count < 1) {
      return res.status(400).json({
        success: false,
        message: 'floor (ID), type, and count (>=1) are required',
      });
    }

    // Verify floor belongs to this root admin
    const floorDoc = await Floor.findOne({ _id: floor, rootAdmin: rootAdminId });
    if (!floorDoc) {
      return res.status(404).json({ success: false, message: 'Floor not found or unauthorized' });
    }

    const seats = [];
    for (let i = 0; i < count; i++) {
      const number = `${prefix}${startNumber + i}`.padStart(3, '0');
      seats.push({
        number,
        type,
        floor,
        createdBy: user._id,
        rootAdmin: rootAdminId,
      });
    }

    const created = await Seat.insertMany(seats, { ordered: false });

    res.status(201).json({
      success: true,
      count: created.length,
      seats: created,
    });
  } catch (err) {
    console.error('addSeatsBulk error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while creating seats',
      error: err.message,
    });
  }
};

// ────────────────────────────────────────────────
// GET ALL SEATS (with optional floor filter)
// ────────────────────────────────────────────────
exports.getAllSeats = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { floor } = req.query;

    const filter = { rootAdmin: rootAdminId };
    if (floor) filter.floor = floor;

    const seats = await Seat.find(filter)
      .populate('floor', 'name')
      .populate('assignedTo', 'name mobile email memberId')
      .sort({ number: 1 })
      .lean();

    res.json({
      success: true,
      count: seats.length,
      data: seats,
    });
  } catch (err) {
    console.error('getAllSeats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// GET SEATS FOR SPECIFIC FLOOR
// ────────────────────────────────────────────────
exports.getSeatsByFloor = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { floorId } = req.params;

    if (!floorId) {
      return res.status(400).json({ success: false, message: 'floorId is required' });
    }

    const seats = await Seat.find({ floor: floorId, rootAdmin: rootAdminId })
      .populate('floor', 'name')
      .populate('assignedTo', 'name mobile memberId')
      .sort({ number: 1 })
      .lean();

    res.json({
      success: true,
      count: seats.length,
      floorId,
      data: seats,
    });
  } catch (err) {
    console.error('getSeatsByFloor error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// GET SEAT STATISTICS
// ────────────────────────────────────────────────
exports.getSeatStats = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const total = await Seat.countDocuments({ rootAdmin: rootAdminId });

    const occupied = await Seat.countDocuments({
      rootAdmin: rootAdminId,
      assignedTo: { $ne: null },
    });
    const available = total - occupied;

    const byType = await Seat.aggregate([
      { $match: { rootAdmin: rootAdminId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          occupied: {
            $sum: { $cond: [{ $ne: ['$assignedTo', null] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          type: '$_id',
          total: 1,
          occupied: 1,
          available: { $subtract: ['$total', '$occupied'] },
          utilization: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$occupied', '$total'] }, 100] }, 1] },
            ],
          },
        },
      },
    ]);

    res.json({
      success: true,
      total,
      occupied,
      available,
      utilization: total > 0 ? Math.round((occupied / total) * 100) : 0,
      byType,
    });
  } catch (err) {
    console.error('getSeatStats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// DELETE SINGLE SEAT
// ────────────────────────────────────────────────
exports.deleteSeat = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const seat = await Seat.findOneAndDelete({
      _id: req.params.id,
      rootAdmin: rootAdminId,
    });

    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found or unauthorized' });
    }

    // Optional: Remove seat reference from member if assigned
    if (seat.assignedTo) {
      await Member.findByIdAndUpdate(seat.assignedTo, { $unset: { seat: 1 } });
    }

    res.json({ success: true, message: 'Seat deleted successfully' });
  } catch (err) {
    console.error('deleteSeat error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// ASSIGN SEAT TO MEMBER
// ────────────────────────────────────────────────
exports.assignSeat = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { member: memberCustomId } = req.body; // ← expects custom memberId like "MEM-0001"

    if (!memberCustomId) {
      return res.status(400).json({ success: false, message: 'member id (MEM-XXXX) is required' });
    }

    const member = await Member.findOne({
      memberId: memberCustomId,
      rootAdmin: rootAdminId,
    });

    if (!member) {
      return res.status(404).json({ message: `Member with ID ${memberCustomId} not found or unauthorized` });
    }

    // Check if seat exists and belongs to rootAdmin
    const seat = await Seat.findOne({
      _id: req.params.id,
      rootAdmin: rootAdminId,
    });

    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found or unauthorized' });
    }

    // Optional: Check if seat is already assigned
    if (seat.assignedTo) {
      return res.status(400).json({ success: false, message: 'Seat is already assigned to another member' });
    }

    // Assign seat
    const updatedSeat = await Seat.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: member._id,
        reserved: false,
        status: 'occupied',
      },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name mobile email memberId')
      .populate('floor', 'name');

    // Update member with seat reference (bidirectional)
    await Member.findByIdAndUpdate(
      member._id,
      { seat: seat._id },
      { new: true }
    );

    res.json({ success: true, data: updatedSeat });
  } catch (err) {
    console.error('assignSeat error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// UNASSIGN SEAT
// ────────────────────────────────────────────────
exports.unassignSeat = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const seat = await Seat.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      {
        $unset: { assignedTo: 1 },
        status: 'available',
      },
      { new: true }
    )
      .populate('floor', 'name');

    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found or unauthorized' });
    }

    // Remove seat reference from member if needed
    if (seat.assignedTo) {
      await Member.findByIdAndUpdate(seat.assignedTo, { $unset: { seat: 1 } });
    }

    res.json({
      success: true,
      message: 'Seat unassigned successfully',
      data: seat,
    });
  } catch (err) {
    console.error('unassignSeat error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────
// GET SINGLE SEAT BY ID
// ────────────────────────────────────────────────
exports.getSeatById = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const seat = await Seat.findOne({
      _id: req.params.id,
      rootAdmin: rootAdminId,
    })
      .populate('floor', 'name')
      .populate('assignedTo', 'name mobile email memberId')
      .lean();

    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found or unauthorized' });
    }

    res.json({
      success: true,
      data: seat,
    });
  } catch (err) {
    console.error('getSeatById error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
const Floor = require('../models/Floor');
const Seat = require('../models/Seat');

const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

exports.createFloor = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { name, description, capacity } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Floor name is required' });
    }

    const existing = await Floor.findOne({ name, rootAdmin: rootAdminId });
    if (existing) {
      return res.status(400).json({ message: 'Floor with this name already exists' });
    }

    const floor = new Floor({
      name,
      description,
      capacity: capacity || 0,
      createdBy: user._id,
      rootAdmin: rootAdminId,
    });

    await floor.save();
    res.status(201).json(floor);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getAllFloors = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const floors = await Floor.find({ rootAdmin: rootAdminId }).lean();

    for (let floor of floors) {
      floor.seatCount = await Seat.countDocuments({ 
        floor: floor._id,
        rootAdmin: rootAdminId 
      });
    }

    res.json(floors);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getFloorById = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const floor = await Floor.findOne({ 
      _id: req.params.id,
      rootAdmin: rootAdminId 
    });

    if (!floor) return res.status(404).json({ message: 'Floor not found' });

    floor.seatCount = await Seat.countDocuments({ 
      floor: floor._id,
      rootAdmin: rootAdminId 
    });

    res.json(floor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateFloor = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const floor = await Floor.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!floor) return res.status(404).json({ message: 'Floor not found or unauthorized' });

    res.json(floor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteFloor = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const floorId = req.params.id;

    const seatCount = await Seat.countDocuments({ 
      floor: floorId,
      rootAdmin: rootAdminId 
    });
    if (seatCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete floor – it has seats assigned. Delete or reassign seats first.'
      });
    }

    const floor = await Floor.findOneAndDelete({ 
      _id: floorId,
      rootAdmin: rootAdminId 
    });

    if (!floor) return res.status(404).json({ message: 'Floor not found or unauthorized' });

    res.json({ message: 'Floor deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
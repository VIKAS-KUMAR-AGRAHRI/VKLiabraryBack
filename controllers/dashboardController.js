const Member = require('../models/Member');
const Billing = require('../models/Billing');
const Seat = require('../models/Seat');

const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

exports.getDashboard = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const totalMembers = await Member.countDocuments({ rootAdmin: rootAdminId });
    const liveMembers = await Member.countDocuments({ 
      rootAdmin: rootAdminId, 
      status: 'active' 
    });
    const blockedMembers = await Member.countDocuments({ 
      rootAdmin: rootAdminId, 
      status: 'blocked' 
    });
    const leftMembers = await Member.countDocuments({ 
      rootAdmin: rootAdminId, 
      status: 'left' 
    });

    const now = new Date();
    const expiryAlerts = {
      '1-3': await Billing.countDocuments({ 
        rootAdmin: rootAdminId,
        endDate: { $gte: now, $lte: new Date(now.getTime() + 3*24*60*60*1000) } 
      }),
      '4-7': await Billing.countDocuments({ 
        rootAdmin: rootAdminId,
        endDate: { $gte: new Date(now.getTime() + 4*24*60*60*1000), $lte: new Date(now.getTime() + 7*24*60*60*1000) } 
      }),
      '8-15': await Billing.countDocuments({ 
        rootAdmin: rootAdminId,
        endDate: { $gte: new Date(now.getTime() + 8*24*60*60*1000), $lte: new Date(now.getTime() + 15*24*60*60*1000) } 
      }),
    };

    const availableSeats = await Seat.countDocuments({ 
      rootAdmin: rootAdminId,
      assignedTo: null, 
      reserved: false 
    });

    res.json({ 
      liveMembers, 
      totalMembers, 
      blockedMembers, 
      leftMembers, 
      expiryAlerts, 
      availableSeats 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};
const Member = require('../models/Member');
const Billing = require('../models/Billing');
const Seat = require('../models/Seat');
const Attendance = require('../models/Attendance');
const Expense = require('../models/Expense');

// Helper to determine root admin
const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

exports.memberReport = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const rootAdminId = getRootAdminId(user);

    const members = await Member.find({ rootAdmin: rootAdminId })
      .populate('seat', 'number type floor')
      .populate('currentPlan', 'name amount duration')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (err) {
    console.error('Member Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.collectionReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const collections = await Billing.aggregate([
      { $match: { rootAdmin: rootAdminId } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          totalEnrollment: { $sum: '$enrollmentFee' },
          totalTax: { $sum: '$taxAmount' },
          totalDiscount: { $sum: '$discountValue' },
        },
      },
    ]);

    const result = collections[0] || {
      totalPaid: 0,
      totalDue: 0,
      totalEnrollment: 0,
      totalTax: 0,
      totalDiscount: 0,
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Collection Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.seatUtilizationReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const totalSeats = await Seat.countDocuments({ rootAdmin: rootAdminId });
    const occupied = await Seat.countDocuments({
      rootAdmin: rootAdminId,
      assignedTo: { $ne: null },
    });
    const available = totalSeats - occupied;

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
      totalSeats,
      occupied,
      available,
      utilization: totalSeats > 0 ? Math.round((occupied / totalSeats) * 100) : 0,
      byType,
    });
  } catch (err) {
    console.error('Seat Utilization Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.attendanceReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { type = 'daily', date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const targetDate = new Date(date);
    let filter = { rootAdmin: rootAdminId };

    if (type === 'daily') {
      filter.date = targetDate;
    } else if (type === 'monthly') {
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      filter.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else {
      return res.status(400).json({ message: 'Invalid type. Use daily or monthly' });
    }

    const report = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$date',
          present: { $sum: { $cond: ['$present', 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      type,
      date: date,
      data: report,
    });
  } catch (err) {
    console.error('Attendance Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.expensesReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const expenses = await Expense.find({ rootAdmin: rootAdminId })
      .sort({ date: -1 })
      .lean();

    const total = await Expense.aggregate([
      { $match: { rootAdmin: rootAdminId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      success: true,
      expenses,
      total: total[0]?.total || 0,
    });
  } catch (err) {
    console.error('Expenses Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.dueReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const dues = await Billing.find({
      rootAdmin: rootAdminId,
      dueAmount: { $gt: 0 },
    })
      .populate('member', 'name mobile memberId')
      .populate('plan', 'name amount')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: dues.length,
      data: dues,
    });
  } catch (err) {
    console.error('Due Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.expiryReport = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiries = await Billing.find({
      rootAdmin: rootAdminId,
      endDate: { $lte: today },
      status: { $ne: 'expired' }, // optional
    })
      .populate('member', 'name mobile memberId')
      .populate('plan', 'name amount duration')
      .sort({ endDate: -1 })
      .lean();

    res.json({
      success: true,
      count: expiries.length,
      data: expiries,
    });
  } catch (err) {
    console.error('Expiry Report Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
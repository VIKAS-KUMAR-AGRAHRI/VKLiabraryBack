const Member = require('../models/Member');
const Billing = require('../models/Billing');
const Plan = require('../models/Plan');
const { isValidObjectId } = require('mongoose');

// Helper to get rootAdminId from authenticated user
const getRootAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

exports.addMember = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const rootAdminId = getRootAdminId(user);

    const {
      memberId,
      name, mobile, email, address, gender, dob, fatherName, uniqueId,
      institute, course, homePhone, batchStart, batchEnd, remarks,
      plan, planAmount, startDate, expiryDate, paymentMethod,
      paidAmount = 0, enrollmentFee = 0, taxAmount = 0, dueAmount = 0,
      ...rest
    } = req.body;

    if (!memberId || !/^MEM-\d{4}$/.test(memberId)) {
      return res.status(400).json({ message: 'Invalid memberId format (use MEM-XXXX)' });
    }

    const member = new Member({
      memberId,
      name: name?.trim(),
      mobile: mobile?.trim(),
      email: email?.trim(),
      address: address?.trim(),
      gender,
      dob: dob ? new Date(dob) : undefined,
      fatherName: fatherName?.trim(),
      uniqueId: uniqueId?.trim(),
      institute: institute?.trim(),
      course: course?.trim(),
      homePhone: homePhone?.trim(),
      batchStart,
      batchEnd,
      remarks: remarks?.trim(),

      currentPlan: plan || undefined,
      planStartDate: startDate ? new Date(startDate) : undefined,
      planExpiryDate: expiryDate ? new Date(expiryDate) : undefined,
      membershipStatus: paidAmount > 0 ? 'active' : 'pending',

      lastPlanAmount: planAmount ? Number(planAmount) : undefined,
      lastEnrollmentFee: enrollmentFee ? Number(enrollmentFee) : undefined,
      lastPaidAmount: paidAmount ? Number(paidAmount) : undefined,
      lastDueAmount: dueAmount ? Number(dueAmount) : undefined,

      createdBy: user._id,
      rootAdmin: rootAdminId,

      ...rest,
    });

    await member.save();

    let billing = null;
    if (plan && isValidObjectId(plan) && startDate) {
      const planDoc = await Plan.findOne({ _id: plan, rootAdmin: rootAdminId });
      if (planDoc) {
        billing = new Billing({
          member: member._id,
          plan,
          startDate: new Date(startDate),
          endDate: expiryDate ? new Date(expiryDate) : undefined,
          paymentMethod: paymentMethod || 'cash',
          paidAmount: Number(paidAmount) || 0,
          enrollmentFee: Number(enrollmentFee) || 0,
          taxAmount: Number(taxAmount) || 0,
          dueAmount: Number(dueAmount) || 0,
          status: Number(dueAmount) > 0 ? (Number(paidAmount) > 0 ? 'partial' : 'pending') : 'paid',
          billDate: new Date(),

          createdBy: user._id,
          rootAdmin: rootAdminId,
        });

        await billing.save();
      } else {
        console.warn(`Plan ${plan} not found or unauthorized for new member ${member._id}`);
      }
    }

    const populated = await Member.findById(member._id).populate('currentPlan');

    res.status(201).json({
      success: true,
      member: populated,
      billingCreated: !!billing,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation failed: ${errors}` });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        message: 'This Member ID is already in use for this admin'
      });
    }

    console.error('Add Member Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
// FREEZE MEMBER – Start from selected date (open-ended)
// ──────────────────────────────────────────────
exports.freezeMember = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);
    const { freezeStartDate, reason } = req.body;

    // 1. Validate input
    if (!freezeStartDate || isNaN(new Date(freezeStartDate).getTime())) {
      return res.status(400).json({ message: 'Valid freeze start date is required (YYYY-MM-DD)' });
    }

    const startDate = new Date(freezeStartDate);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return res.status(400).json({ message: 'Freeze start date cannot be in the past' });
    }

    const member = await Member.findOne({ _id: req.params.id, rootAdmin: rootAdminId });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    // 2. Corner case: Already frozen?
    if (member.status === 'freeze') {
      return res.status(400).json({ message: 'Member is already frozen. Please unfreeze first.' });
    }

    // 3. Corner case: No active plan/expiry?
    if (!member.planExpiryDate) {
      return res.status(400).json({ message: 'Member has no active plan to freeze' });
    }

    // 4. Set current freeze state
    member.freezeStartDate = startDate;
    member.status = 'freeze';

    // 5. Add to history (endDate/days/unfrozenBy will be filled on unfreeze)
    member.freezeHistory.push({
      startDate,
      appliedBy: user._id,
      reason: reason ? reason.trim() : undefined,
    });

    await member.save();

    res.json({
      success: true,
      message: `Member frozen starting from ${startDate.toLocaleDateString()}. Will remain frozen until manually unfrozen.`,
      member,
    });
  } catch (err) {
    console.error('Freeze Member Error:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation failed: ${errors}` });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
// UNFREEZE MEMBER – Calculate frozen days & extend expiry
// ──────────────────────────────────────────────
exports.unfreezeMember = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const member = await Member.findOne({ _id: req.params.id, rootAdmin: rootAdminId });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    if (member.status !== 'freeze') {
      return res.status(400).json({ message: 'Member is not frozen' });
    }

    if (!member.freezeStartDate) {
      return res.status(400).json({ message: 'Invalid freeze state - no start date found' });
    }

    const freezeStart = new Date(member.freezeStartDate);
    freezeStart.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let frozenDays = 0;
    let extensionApplied = false;

    if (today <= freezeStart) {
      // Case 1: Unfreeze BEFORE or ON start date → no extension, cancel freeze
      message = 'Member unfrozen - freeze period had not started or just started today. No extension applied.';
    } else {
      // Case 2: Normal unfreeze AFTER start date → calculate days & extend
      const diffTime = today - freezeStart;
      frozenDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const newExpiry = new Date(member.planExpiryDate);
      const oldExpiry = new Date(member.planExpiryDate);
      newExpiry.setDate(newExpiry.getDate() + frozenDays);

      // Only extend if it actually increases expiry
      if (newExpiry > oldExpiry) {
        member.planExpiryDate = newExpiry;
        extensionApplied = true;
      }

      message = `Member unfrozen after ${frozenDays} day${frozenDays === 1 ? '' : 's'}. ${
        extensionApplied ? `Expiry extended to ${newExpiry.toLocaleDateString()}.` : 'No extension needed (freeze period too short).'
      }`;
    }

    // Update last freeze entry in history
    const lastFreeze = member.freezeHistory[member.freezeHistory.length - 1];
    if (lastFreeze) {
      lastFreeze.endDate = today;
      lastFreeze.days = frozenDays;
      lastFreeze.unfrozenBy = user._id;
    }

    // Clear current freeze state
    member.freezeStartDate = null;
    member.status = 'active';

    await member.save();

    res.json({
      success: true,
      message,
      member,
    });
  } catch (err) {
    console.error('Unfreeze Member Error:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation failed: ${errors}` });
    }
    res.status(500).json({ message: 'Server error' });
  }
};
// ... rest of your controller remains unchanged ...// ──────────────────────────────────────────────────────────────────────────────
// Other controller functions (updated with rootAdmin where needed)
// ──────────────────────────────────────────────────────────────────────────────

const getStatusFilter = (category) => {
  category = (category || '').toLowerCase().trim();

  if (!category || category === 'total') return {};

  if (category === 'live' || category === 'active') return { status: 'active' };

  if (category === 'blocked') return { status: 'blocked' };
  if (category === 'left')    return { status: 'left' };
  if (category === 'freeze')  return { status: 'freeze' };
  if (category === 'expired') return { membershipStatus: 'expired' };

  if (category.startsWith('expiring')) {
    const now = new Date();
    let minDays, maxDays;

    if (category === 'expiring1-3') { minDays = 1; maxDays = 3; }
    if (category === 'expiring4-7') { minDays = 4; maxDays = 7; }
    if (category === 'expiring8-15') { minDays = 8; maxDays = 15; }

    if (minDays && maxDays) {
      const minDate = new Date(now);
      minDate.setDate(now.getDate() + minDays);

      const maxDate = new Date(now);
      maxDate.setDate(now.getDate() + maxDays);

      return {
        membershipStatus: 'active',
        planExpiryDate: { $gte: minDate, $lte: maxDate }
      };
    }
  }

  return {};
};

exports.getMembersByCategory = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { category } = req.query;
    const statusFilter = getStatusFilter(category);
    const filter = { ...statusFilter, rootAdmin: rootAdminId };

    const members = await Member.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(members);
  } catch (err) {
    console.error('getMembersByCategory Error:', err);
    res.status(500).json({ message: 'Server error while fetching members' });
  }
};

exports.getAllMembers = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const members = await Member.find({ rootAdmin: rootAdminId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(members);
  } catch (err) {
    console.error('getAllMembers Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const member = await Member.findOne({ _id: req.params.id, rootAdmin: rootAdminId })
      .populate('seat')
      .populate('currentPlan')
      .lean();

    if (!member) return res.status(404).json({ message: 'Member not found' });

    res.json(member);
  } catch (err) {
    console.error('getMemberById Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.editMember = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!member) return res.status(404).json({ message: 'Member not found' });

    res.json(member);
  } catch (err) {
    console.error('editMember Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Status change handlers
const updateStatus = async (req, res, newStatus) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, rootAdmin: rootAdminId },
      { status: newStatus },
      { new: true }
    );

    if (!member) return res.status(404).json({ message: 'Member not found' });

    res.json({ message: `Member ${newStatus}`, member });
  } catch (err) {
    console.error('updateStatus Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.blockMember   = (req, res) => updateStatus(req, res, 'blocked');
exports.unblockMember = (req, res) => updateStatus(req, res, 'active');

exports.markLeft      = (req, res) => updateStatus(req, res, 'left');

exports.markExpired = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Member.updateMany(
      {
        rootAdmin: rootAdminId,
        membershipStatus: 'active',
        planExpiryDate: { $lt: today }
      },
      { $set: { membershipStatus: 'expired' } }
    );

    res.json({ message: 'Expired members updated', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('markExpired Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.searchMembers = async (req, res) => {
  try {
    const user = req.user;
    const rootAdminId = getRootAdminId(user);

    const { query } = req.query;

    if (!query?.trim()) {
      return res.json([]);
    }

    const members = await Member.find({
      rootAdmin: rootAdminId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { mobile: { $regex: query, $options: 'i' } },
        { uniqueId: { $regex: query, $options: 'i' } }
      ]
    }).limit(20).lean();

    res.json(members);
  } catch (err) {
    console.error('searchMembers Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getNextMemberId = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const rootAdminId = getRootAdminId(user);

    const lastMember = await Member.findOne({ rootAdmin: rootAdminId })
      .sort({ memberId: -1 })
      .select('memberId')
      .lean();

    console.log("Last member found:", lastMember);

    let nextNumber = 1;

    if (lastMember && lastMember.memberId) {
      const match = lastMember.memberId.match(/MEM-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const nextId = `MEM-${nextNumber.toString().padStart(4, '0')}`;

    // Safety check for rare race conditions
    const alreadyExists = await Member.findOne({ 
      memberId: nextId, 
      rootAdmin: rootAdminId 
    });

    if (alreadyExists) {
      console.warn(`Race condition detected: ${nextId} already exists for admin ${rootAdminId}`);
      return res.status(409).json({ 
        success: false, 
        message: 'Temporary ID conflict - please try again' 
      });
    }

    res.json({ success: true, nextMemberId: nextId });
  } catch (err) {
    console.error('Error generating next memberId:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate member ID' 
    });
  }
};

const express = require('express');
const auth = require('../middlewares/auth');
const {
  addMember,
  editMember,
  getAllMembers,
  getMemberById,
  blockMember,
  unblockMember,
  freezeMember,
  unfreezeMember,
  markLeft,
  searchMembers,
  getMembersByCategory,
  getNextMemberId,        // ← NEW
} = require('../controllers/memberController');

const router = express.Router();

// Basic CRUD
router.post('/', auth, addMember);
router.get('/all', auth, getAllMembers);
router.get('/next-id', auth, getNextMemberId);     // ← NEW ROUTE
router.get('/:id', auth, getMemberById);
router.put('/:id', auth, editMember);

// Status changes
router.put('/:id/block', auth, blockMember);
router.put('/:id/unblock', auth, unblockMember);
router.put('/:id/freeze', auth, freezeMember);
router.put('/:id/unfreeze', auth, unfreezeMember);
router.put('/:id/left', auth, markLeft);

// Search & Filtered categories
router.get('/search', auth, searchMembers);
router.get('/', auth, getMembersByCategory);

module.exports = router;
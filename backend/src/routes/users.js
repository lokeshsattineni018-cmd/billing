const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All user management routes require authentication and admin/owner role
router.use(protect);
router.use(restrictTo('admin', 'owner'));

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.json(users);
  } catch (error) {
    console.error('Failed to list users:', error);
    res.status(500).json({ message: 'Failed to fetch user accounts', error: error.message });
  }
});

/**
 * POST /api/users
 * Create a new user account (Admin / Owner exclusive)
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Employee Name is required'),
    body('username').trim().notEmpty().withMessage('Username is required').matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dots, and hyphens'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Enter a valid email address or leave blank'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['staff', 'admin', 'owner']).withMessage('Role must be staff, admin, or owner'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
      }

      const { name, username, email, password, role } = req.body;
      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = email ? email.trim().toLowerCase() : undefined;

      // Check for existing username
      const existingUsername = await User.findOne({ username: cleanUsername });
      if (existingUsername) {
        return res.status(400).json({ message: `Username "${cleanUsername}" is already taken. Please choose another username.` });
      }

      // Check for existing email if provided
      if (cleanEmail) {
        const existingEmail = await User.findOne({ email: cleanEmail });
        if (existingEmail) {
          return res.status(400).json({ message: `An account with email "${cleanEmail}" already exists` });
        }
      }

      const newUser = await User.create({
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername}@vijayadurgagencies.local`,
        password,
        role: role || 'staff',
      });

      // Audit Log
      try {
        await ActivityLog.create({
          user: req.user._id,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'CREATE_USER',
          targetId: newUser._id.toString(),
          targetType: 'USER',
          details: { createdUsername: cleanUsername, createdEmail: newUser.email, createdRole: role, createdName: name },
          ip: req.ip || '',
        });
      } catch (logErr) {
        console.warn('ActivityLog error on user creation:', logErr.message);
      }

      res.status(201).json({
        message: 'User account created successfully',
        user: {
          _id: newUser._id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to create user:', error);
      res.status(500).json({ message: 'Failed to create user account', error: error.message });
    }
  }
);

// Helper to identify the Master Admin account
const isMasterAdmin = (user) => {
  if (!user) return false;
  return (
    (user.username && user.username.toLowerCase() === 'lokesh18') ||
    (user.email && user.email.toLowerCase().startsWith('lokesh18@'))
  );
};

/**
 * PATCH /api/users/:id/password
 * Change / reset password for any user account
 */
router.patch(
  '/:id/password',
  [
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User account not found' });
      }

      // Master Admin Protection: No other admin can reset lokesh18's password
      if (isMasterAdmin(user) && !isMasterAdmin(req.user)) {
        return res.status(403).json({ message: 'Security Policy: Only Master Admin (lokesh18) can change their own password.' });
      }

      const { newPassword } = req.body;
      user.password = newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior active sessions
      await user.save();

      // Audit Log
      try {
        await ActivityLog.create({
          user: req.user._id,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'RESET_PASSWORD',
          targetId: user._id.toString(),
          targetType: 'USER',
          details: { targetUsername: user.username, targetEmail: user.email, targetRole: user.role },
          ip: req.ip || '',
        });
      } catch (logErr) {
        console.warn('ActivityLog error on password reset:', logErr.message);
      }

      res.json({ message: `Password for ${user.username || user.email} updated successfully. Previous sessions invalidated.` });
    } catch (error) {
      console.error('Failed to reset password:', error);
      res.status(500).json({ message: 'Failed to reset password', error: error.message });
    }
  }
);

/**
 * PUT /api/users/:id
 * Update user details (name, role, email) - Allows promoting/demoting user roles
 */
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role').optional().isIn(['staff', 'admin', 'owner']).withMessage('Role must be staff, admin, or owner'),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User account not found' });
      }

      // Master Admin Protection: Nobody else can modify lokesh18's account
      if (isMasterAdmin(user)) {
        if (!isMasterAdmin(req.user)) {
          return res.status(403).json({ message: 'Security Policy: Only Master Admin (lokesh18) can modify their account.' });
        }
        if (req.body.role && req.body.role !== 'admin') {
          return res.status(400).json({ message: 'Master Admin account role must remain Admin.' });
        }
      }

      const { name, email, role } = req.body;

      if (email && email !== user.email) {
        const emailTaken = await User.findOne({ email, _id: { $ne: id } });
        if (emailTaken) {
          return res.status(400).json({ message: `Email "${email}" is already used by another account` });
        }
        user.email = email;
      }

      if (name) user.name = name.trim();
      if (role) user.role = role;

      await user.save();

      // Audit Log
      try {
        await ActivityLog.create({
          user: req.user._id,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'UPDATE_USER',
          targetId: user._id.toString(),
          targetType: 'USER',
          details: { updatedUsername: user.username, updatedRole: user.role, updatedName: user.name },
          ip: req.ip || '',
        });
      } catch (logErr) {
        console.warn('ActivityLog error on user update:', logErr.message);
      }

      res.json({
        message: `User account "${user.username || user.name}" updated successfully`,
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error('Failed to update user:', error);
      res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Delete user account with Master Admin protection
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    // Master Admin Protection
    if (isMasterAdmin(user)) {
      return res.status(403).json({ message: 'Security Policy: The Master Admin account (lokesh18) is protected and can never be deleted.' });
    }

    // Safety check: Cannot delete own account
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'Security restriction: You cannot delete your own logged-in account.' });
    }

    await User.findByIdAndDelete(id);

    // Audit Log
    try {
      await ActivityLog.create({
        user: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'DELETE_USER',
        targetId: id,
        targetType: 'USER',
        details: { deletedUsername: user.username, deletedEmail: user.email, deletedName: user.name, deletedRole: user.role },
        ip: req.ip || '',
      });
    } catch (logErr) {
      console.warn('ActivityLog error on user deletion:', logErr.message);
    }

    res.json({ message: `User account "${user.username || user.email}" deleted successfully` });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ message: 'Failed to delete user account', error: error.message });
  }
});

module.exports = router;

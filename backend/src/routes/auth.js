const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Generate JWT
const signToken = (id) => {
  const secret = (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) || 'vijaya-durga-super-secret-key-2024';
  let expiresIn = '7d';
  if (typeof process.env.JWT_EXPIRES_IN === 'string') {
    const cleaned = process.env.JWT_EXPIRES_IN.replace(/['"]/g, '').trim();
    if (/^\d+[smhdwy]?$/i.test(cleaned)) {
      expiresIn = cleaned;
    }
  } else if (typeof process.env.JWT_EXPIRES_IN === 'number' && process.env.JWT_EXPIRES_IN > 0) {
    expiresIn = process.env.JWT_EXPIRES_IN;
  }
  return jwt.sign({ id }, secret, { expiresIn });
};

/**
 * Helper to auto-seed default users on startup (only creates if missing)
 */
async function autoSeedUsers() {
  const defaultUsers = [
    { name: 'Owner', email: 'owner@srsf.com', password: 'owner123', role: 'owner' },
    { name: 'Admin', email: 'admin@srsf.com', password: 'admin123', role: 'admin' },
    { name: 'Employee', email: 'employee@srsf.com', password: 'emp123', role: 'staff' },
    { name: 'Proprietor', email: 'admin@vijayadurgagencies.com', password: 'admin123', role: 'owner' },
    { name: 'Staff', email: 'staff@vijayadurgagencies.com', password: 'staff123', role: 'staff' },
  ];

  for (const u of defaultUsers) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await User.create(u);
      console.log(`Default user created: ${u.email} (${u.role})`);
    }
  }
}

/**
 * POST /api/auth/seed
 * Seed default accounts (owner/admin only, or first-time when no users exist)
 */
router.post('/seed', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      // If users already exist, require owner/admin auth
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      if (!token) {
        return res.status(401).json({ message: 'Accounts already exist. Authentication required to re-seed.' });
      }
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const caller = await User.findById(decoded.id);
      if (!caller || !['owner', 'admin'].includes(caller.role)) {
        return res.status(403).json({ message: 'Only owner or admin can re-seed accounts' });
      }
    }
    await autoSeedUsers();
    res.json({ message: 'Default accounts seeded successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Seeding error', error: error.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', protect, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
module.exports.autoSeedUsers = autoSeedUsers;

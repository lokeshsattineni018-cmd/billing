const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authLimiter, getJwtSecret } = require('../middleware/security');

const router = express.Router();

// Generate JWT with secure secret and tokenVersion
const signToken = (id, tokenVersion = 0) => {
  const secret = getJwtSecret();
  let expiresIn = '7d';
  if (typeof process.env.JWT_EXPIRES_IN === 'string') {
    const cleaned = process.env.JWT_EXPIRES_IN.replace(/['"]/g, '').trim();
    if (/^\d+[smhdwy]?$/i.test(cleaned)) {
      expiresIn = cleaned;
    }
  } else if (typeof process.env.JWT_EXPIRES_IN === 'number' && process.env.JWT_EXPIRES_IN > 0) {
    expiresIn = process.env.JWT_EXPIRES_IN;
  }
  return jwt.sign({ id, tokenVersion }, secret, { expiresIn });
};

/**
 * Helper to auto-seed default users only when the database is completely empty (0 users)
 */
async function autoSeedUsers() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return; // Do not recreate accounts once any users exist in MongoDB

  const defaultUsers = [
    { name: 'Admin', email: 'admin@srsf.com', password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', role: 'admin' },
    { name: 'Proprietor', email: 'admin@vijayadurgagencies.com', password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', role: 'owner' },
    { name: 'Staff', email: 'staff@vijayadurgagencies.com', password: process.env.DEFAULT_STAFF_PASSWORD || 'staff123', role: 'staff' },
  ];

  for (const u of defaultUsers) {
    await User.create(u);
    console.log(`Default user initialized: ${u.email} (${u.role})`);
  }
}

/**
 * POST /api/auth/seed
 * Strictly protected account seeding
 */
router.post('/seed', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      if (!token) {
        return res.status(401).json({ message: 'Accounts already exist. Admin authentication required.' });
      }
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      const caller = await User.findById(decoded.id);
      if (!caller || !['owner', 'admin'].includes(caller.role)) {
        return res.status(403).json({ message: 'Only owner or admin can re-seed accounts' });
      }
    }
    await autoSeedUsers();
    res.json({ message: 'Default accounts initialized successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Seeding error', error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Brute-force rate limited & sanitized
 */
router.post('/login', authLimiter, [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id, user.tokenVersion || 0);

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
 * POST /api/auth/logout
 * Invalidate all existing tokens server-side by incrementing user tokenVersion
 */
router.post('/logout', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logged out successfully. All sessions invalidated.' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed', error: error.message });
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

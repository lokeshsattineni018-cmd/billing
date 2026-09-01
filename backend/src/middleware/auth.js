const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — requires valid JWT in Authorization header
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized — no token provided' });
    }

    const { getJwtSecret } = require('./security');
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Not authorized — user not found' });
    }

    // Server-side Token Invalidation Check
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Session expired or logged out. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized — invalid token' });
  }
};

/**
 * Restrict to specific roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

module.exports = { protect, restrictTo };

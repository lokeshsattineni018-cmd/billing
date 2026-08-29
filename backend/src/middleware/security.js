const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter for Authentication / Login endpoints (brute force protection)
 * Max 15 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate Limiter for Bill Creation endpoint (anti-spam / anti-denial-of-service)
 * Max 120 bill creations per 5 minutes per IP
 */
const billCreateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many invoices created in a short period. Please wait a moment.',
  },
});

/**
 * General API Rate Limiter
 * Max 400 requests per 5 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please slow down.',
  },
});

/**
 * MongoDB Operator Injection Sanitizer
 * Recursively cleans '$' and '.' from object keys in req.body and req.query
 */
function sanitizeMongoInput(req, res, next) {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
}

/**
 * Escape regular expression special characters to prevent ReDoS & unintended regex matching
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Validates that JWT secret is securely configured
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
    }
    return 'vijaya-durga-default-dev-secret-key-do-not-use-in-prod';
  }
  return secret;
}

module.exports = {
  authLimiter,
  billCreateLimiter,
  generalLimiter,
  sanitizeMongoInput,
  escapeRegex,
  getJwtSecret,
};

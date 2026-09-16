/**
 * Error Tracking & Monitoring Bridge
 * Integrates optional Sentry SDK if SENTRY_DSN is configured.
 * Gracefully captures unhandled exceptions with full stack traces and contextual metadata.
 * Provides sanitized server error responses ensuring ZERO technical leaks to clients.
 */

const logger = require('./structuredLogger');

let sentryInitialized = false;

function initErrorTracking(app) {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'production',
        tracesSampleRate: 0.2, // 20% trace sampling for performance
      });
      sentryInitialized = true;
      console.log('✅ Sentry Error Tracking initialized successfully.');
    } catch (err) {
      console.warn('⚠️ Sentry module not installed or failed to initialize:', err.message);
    }
  } else {
    // Standard structured error fallback
    console.log('ℹ️ Error Tracking: Running in fallback mode (Console & Structured JSON logging). Set SENTRY_DSN for cloud alerting.');
  }
}

function captureException(error, context = {}, req = null) {
  // 1. Structured log
  logger.error(
    'UNHANDLED_EXCEPTION',
    error.message || 'Unknown error',
    {
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
    },
    req
  );

  // 2. Dispatch to Sentry if active
  if (sentryInitialized) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.withScope((scope) => {
        if (req?.user) {
          scope.setUser({
            id: req.user._id?.toString(),
            username: req.user.username,
            role: req.user.role,
          });
        }
        if (context) {
          scope.setExtras(context);
        }
        Sentry.captureException(error);
      });
    } catch (sentryErr) {
      console.error('Failed to forward error to Sentry:', sentryErr.message);
    }
  }
}

/**
 * Cleanly handles 500 server errors by logging full stack/context to server-side telemetry
 * while strictly returning generic, sanitized error messages to the HTTP client in production.
 */
function handleServerError(res, error, publicMessage = 'Internal server error. Please try again later.', req = null) {
  captureException(error, { publicMessage }, req);
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    message: isDev ? (error.message || publicMessage) : publicMessage,
    ...(isDev && error.stack ? { stack: error.stack } : {}),
  });
}

module.exports = {
  initErrorTracking,
  captureException,
  handleServerError,
};

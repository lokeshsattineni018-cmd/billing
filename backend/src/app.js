require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('./config/db');
require('./models'); // Register all Mongoose schemas immediately
const { sanitizeMongoInput, generalLimiter } = require('./middleware/security');

// Route imports
const authRoutes = require('./routes/auth');
const { autoSeedUsers } = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const itemsRoutes = require('./routes/items');
const billsRoutes = require('./routes/bills');
const dashboardRoutes = require('./routes/dashboard');
const pdfRoutes = require('./routes/pdf');
const reportsRoutes = require('./routes/reports');
const customersRoutes = require('./routes/customers');
const activityLogsRoutes = require('./routes/activityLogs');
const usersRoutes = require('./routes/users');
const backupRoutes = require('./routes/backup');
const mongoose = require('mongoose');
const { initErrorTracking, captureException, handleServerError } = require('./utils/errorTracker');
const structuredLogger = require('./utils/structuredLogger');

const app = express();
initErrorTracking(app);

// Trust reverse proxy headers (Vercel, Render, Cloudflare)
app.set('trust proxy', 1);

// High-speed gzip/deflate response compression
app.use(compression());

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows PDF streaming and inline preview
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Strict Domain Whitelist for CORS
const allowedOrigins = [
  'https://billing-snowy-three.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

if (process.env.CLIENT_URL) {
  const envUrl = process.env.CLIENT_URL.replace(/\/$/, '');
  if (!allowedOrigins.includes(envUrl)) {
    allowedOrigins.push(envUrl);
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Exact whitelist match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Match Vercel preview deployment domains for this project
    if (/^https:\/\/billing-[a-z0-9-]+-lokeshsattinenis-projects\.vercel\.app$/.test(origin) ||
        /^https:\/\/billing-snowy-three.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for unauthorized origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parser with size limits to prevent body-overflow DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL / MongoDB Operator Injection Sanitization
app.use(sanitizeMongoInput);

// General API Rate Limiting
app.use('/api', generalLimiter);

// Request logger for serverless observability
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

let isDbSeeded = false;

// Middleware to ensure DB is connected for serverless invocations
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!isDbSeeded) {
      isDbSeeded = true;
      autoSeedUsers().catch((e) => console.log('Seed note:', e.message));
    }
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err);
    return handleServerError(res, err, 'Database connection failed. Please try again later.', req);
  }
});

// Mount routes with and without /api prefix for robust serverless handling
const routeMappings = [
  ['/auth', authRoutes],
  ['/settings', settingsRoutes],
  ['/items', itemsRoutes],
  ['/bills', billsRoutes],
  ['/bills', pdfRoutes],
  ['/dashboard', dashboardRoutes],
  ['/reports', reportsRoutes],
  ['/customers', customersRoutes],
  ['/activity-logs', activityLogsRoutes],
  ['/users', usersRoutes],
  ['/backup', backupRoutes],
];

routeMappings.forEach(([path, handler]) => {
  app.use(`/api${path}`, handler);
  app.use(path, handler);
});

// Health check & Diagnostic Dashboard
app.get(['/api/health', '/health'], async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;
  let dbPingMs = null;

  if (isDbConnected && mongoose.connection.db) {
    try {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbPingMs = Date.now() - pingStart;
    } catch (e) {
      dbPingMs = -1;
    }
  }

  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const healthData = {
    status: isDbConnected ? 'ok' : 'degraded',
    service: 'srsf-billing-backend',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
    uptimeSeconds: uptimeSec,
    database: {
      status: isDbConnected ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected',
      readyState: dbState,
      pingMs: dbPingMs,
    },
    system: {
      memoryHeapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      memoryHeapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      memoryRssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      nodeVersion: process.version,
      platform: process.platform,
    },
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
  };

  // If HTML format explicitly requested, require lightweight secret or Basic Auth
  if (req.query.format === 'html') {
    const expectedSecret = process.env.HEALTH_SECRET || process.env.CRON_SECRET || 'srsf-health-key';
    let isHtmlAuthorized = false;

    // 1. Header check (X-Health-Secret or X-Cron-Secret)
    const headerSecret = req.headers['x-health-secret'] || req.headers['x-cron-secret'];
    if (headerSecret && headerSecret === expectedSecret) {
      isHtmlAuthorized = true;
    }

    // 2. HTTP Basic Auth check
    const authHeader = req.headers.authorization;
    if (!isHtmlAuthorized && authHeader && authHeader.startsWith('Basic ')) {
      try {
        const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
        const [user, pass] = credentials.split(':');
        if (pass === expectedSecret || user === expectedSecret) {
          isHtmlAuthorized = true;
        }
      } catch (e) {
        // Invalid basic auth header format
      }
    }

    // 3. Lightweight query secret check fallback (?secret=)
    if (!isHtmlAuthorized && req.query.secret && req.query.secret === expectedSecret) {
      isHtmlAuthorized = true;
    }

    if (!isHtmlAuthorized) {
      res.setHeader('WWW-Authenticate', 'Basic realm="SRSF Health Dashboard"');
      return res.status(401).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>401 Unauthorized — SRSF Health</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; max-width: 420px; text-align: center; }
    h2 { color: #f87171; margin-top: 0; font-size: 1.25rem; }
    p { color: #94a3b8; font-size: 0.88rem; line-height: 1.6; margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🔒 Protected Dashboard</h2>
    <p>Authentication required to view the visual health monitor. Provide HTTP Basic Auth credentials or X-Health-Secret header.</p>
  </div>
</body>
</html>`);
    }

    const statusColor = isDbConnected ? '#10b981' : '#ef4444';
    const statusBadge = isDbConnected ? 'HEALTHY' : 'DEGRADED';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SRSF Billing System — Server Health</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 24px; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; max-width: 520px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 12px; color: #94a3b8; margin-top: 3px; }
    .badge { background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .metric { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
    .metric-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .metric-value { font-size: 15px; font-weight: 600; color: #f1f5f9; }
    .footer { font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 14px; }
    .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; margin-right: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">Vijaya Durga Agencies</div>
        <div class="subtitle">API & Database Health Monitor</div>
      </div>
      <span class="badge"><span class="pulse"></span>${statusBadge}</span>
    </div>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">MongoDB Atlas</div>
        <div class="metric-value">${isDbConnected ? 'Connected (' + dbPingMs + 'ms)' : 'Disconnected'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Server Uptime</div>
        <div class="metric-value">${healthData.uptime}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Memory Usage</div>
        <div class="metric-value">${healthData.system.memoryHeapUsedMB} MB / ${healthData.system.memoryRssMB} MB</div>
      </div>
      <div class="metric">
        <div class="metric-label">Node & Platform</div>
        <div class="metric-value">${healthData.system.nodeVersion} (${healthData.system.platform})</div>
      </div>
    </div>
    <div class="footer">
      Timestamp: ${healthData.timestamp} • Env: ${healthData.environment}
    </div>
  </div>
</body>
</html>`;
    return res.type('html').send(html);
  }

  res.status(isDbConnected ? 200 : 503).json(healthData);
});

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ message: `API Route ${req.originalUrl || req.url} not found` });
});

// Centralized error handler with error tracking
app.use((err, req, res, next) => {
  captureException(err, { url: req.originalUrl, method: req.method }, req);
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';
  const message = (status >= 500 && !isDev) ? 'Internal server error' : (err.message || 'Internal server error');
  res.status(status).json({
    message,
    ...(isDev && err.stack ? { stack: err.stack } : {}),
  });
});

module.exports = app;

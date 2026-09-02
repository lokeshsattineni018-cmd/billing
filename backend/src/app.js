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

const app = express();

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
    res.status(500).json({ message: 'Database connection failed', error: err.message });
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
];

routeMappings.forEach(([path, handler]) => {
  app.use(`/api${path}`, handler);
  app.use(path, handler);
});

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ message: `API Route ${req.originalUrl || req.url} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;

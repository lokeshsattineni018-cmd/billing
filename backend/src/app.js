require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { sanitizeMongoInput, generalLimiter } = require('./middleware/security');

// Route imports
const authRoutes = require('./routes/auth');
const { autoSeedUsers } = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const itemsRoutes = require('./routes/items');
const billsRoutes = require('./routes/bills');
const dashboardRoutes = require('./routes/dashboard');
const pdfRoutes = require('./routes/pdf');

const app = express();

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows PDF streaming and inline preview
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Strictly Configured CORS
const allowedOrigins = [
  'https://billing-snowy-three.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed list or vercel preview domains
    const isAllowed = allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin);
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked request from unauthorized origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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

// Middleware to ensure DB is connected for serverless invocations
app.use(async (req, res, next) => {
  try {
    await connectDB();
    autoSeedUsers().catch((e) => console.log('Seed note:', e.message));
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

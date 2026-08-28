require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/auth');
const { autoSeedUsers } = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const itemsRoutes = require('./routes/items');
const billsRoutes = require('./routes/bills');
const dashboardRoutes = require('./routes/dashboard');
const pdfRoutes = require('./routes/pdf');

const app = express();

// Standard Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Request logger for debugging in Vercel
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
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

module.exports = app;

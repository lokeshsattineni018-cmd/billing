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

// Connect to MongoDB & Auto seed
connectDB().then(() => {
  autoSeedUsers();
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/bills', pdfRoutes); // /api/bills/:id/pdf
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SRSF Backend running on port ${PORT}`);
});

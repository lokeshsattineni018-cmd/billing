/**
 * Standalone Database Seeder
 * Safe initialization of default admin & staff accounts on fresh databases
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { autoSeedUsers } = require('../src/routes/auth');

async function run() {
  try {
    await connectDB();
    await autoSeedUsers();
    console.log('Database initialization / seeding check finished.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

run();

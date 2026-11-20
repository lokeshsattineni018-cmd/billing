const mongoose = require('mongoose');

// Maintain global connection cache across serverless warm container invocations
if (!global._mongoose) {
  global._mongoose = { conn: null, promise: null };
}

const resetDbConnectionCache = () => {
  global._mongoose = { conn: null, promise: null };
};

const connectDB = async () => {
  const readyState = mongoose.connection.readyState;

  // 1. Connected: return active connection immediately
  if (readyState === 1 && global._mongoose.conn) {
    return global._mongoose.conn;
  }

  if (readyState === 1) {
    global._mongoose.conn = mongoose.connection;
    return global._mongoose.conn;
  }

  // 2. Disconnected (0) or Disconnecting (3): purge stale cache to force fresh connect
  if (readyState === 0 || readyState === 3) {
    global._mongoose.conn = null;
    global._mongoose.promise = null;
  }

  // 3. In-flight connection attempt: share existing promise
  if (global._mongoose.promise && readyState === 2) {
    return global._mongoose.promise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required. Please set it in Vercel Environment Variables.');
  }

  global._mongoose.promise = mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    family: 4, // Use IPv4, skip slow IPv6 DNS lookups on serverless
  }).then((conn) => {
    global._mongoose.conn = conn;
    console.log(`MongoDB connected: ${global._mongoose.conn.connection ? global._mongoose.conn.connection.host : 'active'}`);
    return global._mongoose.conn;
  }).catch((error) => {
    global._mongoose.promise = null;
    global._mongoose.conn = null;
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  });

  return global._mongoose.promise;
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.resetDbConnectionCache = resetDbConnectionCache;

const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI || 'mongodb+srv://lokeshsattineni018_db_user:Ee8p5cKgOTUH0Y2T@cluster0.jaruuh3.mongodb.net/vijaya_durga?retryWrites=true&w=majority';

  try {
    cachedConnection = await mongoose.connect(uri, {
      bufferCommands: false,
    });
    console.log(`MongoDB connected: ${cachedConnection.connection.host}`);
    return cachedConnection;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;

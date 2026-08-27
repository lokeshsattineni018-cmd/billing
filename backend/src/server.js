const app = require('./app');
const connectDB = require('./config/db');
const { autoSeedUsers } = require('./routes/auth');

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  autoSeedUsers();
  app.listen(PORT, () => {
    console.log(`VIJAYA DURGA AGENCIES Backend running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to DB:', err);
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT} (DB connection pending)`);
  });
});

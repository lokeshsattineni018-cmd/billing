const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const { autoSeedUsers } = require('../../src/routes/auth');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/srsf_test_suite';

describe('Auto-Seed Security & Password Privacy', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await User.deleteMany({ email: { $in: ['lokesh18@vijayadurgagencies.local', 'staff@vijayadurgagencies.com'] } });
  });

  after(async () => {
    await User.deleteMany({ email: { $in: ['lokesh18@vijayadurgagencies.local', 'staff@vijayadurgagencies.com'] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('autoSeedUsers does not log generated passwords or sensitive tokens to console', async () => {
    const originalLog = console.log;
    const capturedLogs = [];
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
    };

    try {
      await autoSeedUsers();
      // Verify users were created
      const admin = await User.findOne({ username: 'lokesh18' });
      const staff = await User.findOne({ username: 'staff' });
      assert.ok(admin, 'Admin user should be seeded');
      assert.ok(staff, 'Staff user should be seeded');

      // Verify no password was logged in stdout
      for (const log of capturedLogs) {
        assert.strictEqual(
          log.includes('Auto-generated temporary'),
          false,
          `Log leaked temporary password notices: ${log}`
        );
        assert.strictEqual(
          /password:\s*[a-f0-9]{8,}/i.test(log),
          false,
          `Log leaked hex password: ${log}`
        );
      }
    } finally {
      console.log = originalLog;
    }
  });
});

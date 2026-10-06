/**
 * SRSF Disaster Recovery — Automated Backup Restore Utility
 * Usage: node scripts/restoreBackup.js <path-to-backup-json-file> [--dry-run]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Bill = require('../src/models/Bill');
const Customer = require('../src/models/Customer');
const StaffWork = require('../src/models/StaffWork');
const DailyIce = require('../src/models/DailyIce');
const DailyWastage = require('../src/models/DailyWastage');
const Settings = require('../src/models/Settings');

async function restoreBackup(filePath, isDryRun = false) {
  if (!filePath) {
    console.error('Error: Please provide the path to the backup JSON file.');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Backup file not found at: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`[DR RECOVERY] Reading backup snapshot: ${resolvedPath}`);
  const rawData = fs.readFileSync(resolvedPath, 'utf8');
  let backup;
  try {
    backup = JSON.parse(rawData);
  } catch (err) {
    console.error('Error: Failed to parse JSON backup file:', err.message);
    process.exit(1);
  }

  if (!backup.data || typeof backup.data !== 'object') {
    console.error('Error: Invalid backup format. Missing "data" root property.');
    process.exit(1);
  }

  console.log(`[DR RECOVERY] Snapshot version: ${backup.version || '1.0.0'} | Exported at: ${backup.exportedAt}`);
  console.log(`[DR RECOVERY] Backup summary:`, backup.counts || 'Counts not available');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('[DR RECOVERY] DRY-RUN MODE: Validation passed. No database writes will be performed.');
    return { success: true, dryRun: true, counts: backup.counts };
  }

  console.log('[DR RECOVERY] Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('[DR RECOVERY] Connected successfully.');

  const results = {
    billsRestored: 0,
    customersRestored: 0,
    staffWorkRestored: 0,
    iceRestored: 0,
    wastageRestored: 0,
    settingsRestored: false,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { bills = [], customers = [], staffWork = [], iceTracking = [], wastageTracking = [], settings = null } = backup.data;

      // 1. Restore Bills
      if (bills.length > 0) {
        for (const b of bills) {
          await Bill.updateOne({ _id: b._id }, { $set: b }, { upsert: true, session });
        }
        results.billsRestored = bills.length;
        console.log(`  ✓ Restored ${bills.length} bills`);
      }

      // 2. Restore Customers
      if (customers.length > 0) {
        for (const c of customers) {
          await Customer.updateOne({ _id: c._id }, { $set: c }, { upsert: true, session });
        }
        results.customersRestored = customers.length;
        console.log(`  ✓ Restored ${customers.length} customer records`);
      }

      // 3. Restore StaffWork
      if (staffWork.length > 0) {
        for (const s of staffWork) {
          await StaffWork.updateOne({ _id: s._id }, { $set: s }, { upsert: true, session });
        }
        results.staffWorkRestored = staffWork.length;
        console.log(`  ✓ Restored ${staffWork.length} staff attendance/work records`);
      }

      // 4. Restore DailyIce
      if (iceTracking.length > 0) {
        for (const ice of iceTracking) {
          await DailyIce.updateOne({ _id: ice._id }, { $set: ice }, { upsert: true, session });
        }
        results.iceRestored = iceTracking.length;
        console.log(`  ✓ Restored ${iceTracking.length} ice procurement entries`);
      }

      // 5. Restore DailyWastage
      if (wastageTracking.length > 0) {
        for (const w of wastageTracking) {
          await DailyWastage.updateOne({ _id: w._id }, { $set: w }, { upsert: true, session });
        }
        results.wastageRestored = wastageTracking.length;
        console.log(`  ✓ Restored ${wastageTracking.length} prawn wastage sales records`);
      }

      // 6. Restore Settings
      if (settings && Object.keys(settings).length > 0) {
        const { _id, ...settingsFields } = settings;
        await Settings.findOneAndUpdate({}, { $set: settingsFields }, { upsert: true, session });
        results.settingsRestored = true;
        console.log(`  ✓ Restored business settings and bank credentials`);
      }
    });

    console.log('[DR RECOVERY] Full disaster recovery restoration completed successfully!');
    return { success: true, results };
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const filePath = args.find((a) => !a.startsWith('--'));

  restoreBackup(filePath, isDryRun)
    .then((res) => {
      console.log('[DR RECOVERY] Operation finished with code 0.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DR RECOVERY ERROR]:', err);
      process.exit(1);
    });
}

module.exports = { restoreBackup };

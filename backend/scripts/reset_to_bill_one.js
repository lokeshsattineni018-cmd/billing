const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function resetToBillOne() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database:', mongoose.connection.name);

    // 1. Read existing bills
    const billsCollection = mongoose.connection.collection('bills');
    const existingBills = await billsCollection.find({}).sort({ billNo: 1 }).toArray();
    console.log(`Found ${existingBills.length} existing bills.`);

    // 2. Save backup to JSON file
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const backupFilePath = path.join(dataDir, 'bills_backup.json');
    fs.writeFileSync(backupFilePath, JSON.stringify(existingBills, null, 2), 'utf8');
    console.log(`Saved JSON backup to: ${backupFilePath}`);

    // 3. Backup to MongoDB collection `bills_backup`
    if (existingBills.length > 0) {
      const backupCollection = mongoose.connection.collection('bills_backup');
      await backupCollection.deleteMany({});
      await backupCollection.insertMany(existingBills);
      console.log(`Backed up ${existingBills.length} bills to 'bills_backup' MongoDB collection.`);
    }

    // 4. Clear active bills collection
    const deleteResult = await billsCollection.deleteMany({});
    console.log(`Cleared active bills collection: deleted ${deleteResult.deletedCount} documents.`);

    // 5. Reset Counter for 'billNo' to 0
    const countersCollection = mongoose.connection.collection('counters');
    await countersCollection.updateOne(
      { _id: 'billNo' },
      { $set: { seq: 0 } },
      { upsert: true }
    );
    const counterDoc = await countersCollection.findOne({ _id: 'billNo' });
    console.log(`Reset counter 'billNo' sequence:`, counterDoc);

    console.log('SUCCESS: Next created bill will be #1 (VDA/0001).');
  } catch (error) {
    console.error('Error resetting bills to #1:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

resetToBillOne();

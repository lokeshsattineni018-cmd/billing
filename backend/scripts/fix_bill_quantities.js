/**
 * fix_bill_quantities.js
 * 
 * One-time migration script to fix bill.quantity for existing bills.
 * The old code stored only the first item's quantity instead of the sum of all items.
 * This script recalculates bill.quantity as the sum of all items' quantities.
 * 
 * Usage: node scripts/fix_bill_quantities.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Bill = require('../src/models/Bill');

async function fixQuantities() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const bills = await Bill.find({ 'items.1': { $exists: true } }); // Bills with 2+ items
    console.log(`Found ${bills.length} bills with multiple items to check`);

    let fixed = 0;
    for (const bill of bills) {
      const correctQty = bill.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
      if (Math.abs(bill.quantity - correctQty) > 0.01) {
        console.log(`  Bill #${bill.billNo}: ${bill.quantity} kg → ${correctQty} kg (${bill.companyName})`);
        bill.quantity = correctQty;
        await bill.save();
        fixed++;
      }
    }

    console.log(`\nDone! Fixed ${fixed} bills out of ${bills.length} checked.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixQuantities();

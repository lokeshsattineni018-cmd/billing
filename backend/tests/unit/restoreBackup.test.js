const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { restoreBackup } = require('../../scripts/restoreBackup');

describe('Disaster Recovery — Automated Backup Restore Utility', () => {
  const sampleBackupPath = path.join(__dirname, 'fixtures_sample_backup.json');

  const sampleBackupData = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    businessName: 'VIJAYA DURGA SEA FOODS',
    counts: {
      bills: 1,
      customers: 1,
      staffWorkEntries: 1,
      iceRecords: 1,
      wastageRecords: 1,
    },
    data: {
      bills: [
        {
          _id: '670000000000000000000001',
          billNo: 101,
          formattedBillNo: 'VDA/0101',
          date: '2026-10-01T00:00:00.000Z',
          companyName: 'Test Prawn Buyer',
          companyGstin: '37AAAAA0000A1Z5',
          total: 10000,
          grandTotal: 10500,
          paymentStatus: 'Paid',
          isVoided: false,
        },
      ],
      customers: [
        {
          _id: '670000000000000000000002',
          name: 'Test Prawn Buyer',
          phone: '9876543210',
          creditLimit: 50000,
        },
      ],
      staffWork: [
        {
          _id: '670000000000000000000003',
          staffName: 'Ramesh',
          date: '2026-10-01T00:00:00.000Z',
          quantity: 50,
          price: 4,
          totalAmount: 200,
          paymentStatus: 'Paid',
        },
      ],
      iceTracking: [
        {
          _id: '670000000000000000000004',
          date: '2026-10-01T00:00:00.000Z',
          blocks: 20,
          rate: 150,
          totalAmount: 3000,
        },
      ],
      wastageTracking: [
        {
          _id: '670000000000000000000005',
          date: '2026-10-01T00:00:00.000Z',
          category: 'Prawn Heads',
          quantityKg: 100,
          rate: 5,
          totalAmount: 500,
        },
      ],
      settings: {
        businessName: 'VIJAYA DURGA SEA FOODS',
        phone: '9441429745',
      },
    },
  };

  it('validates and parses backup JSON snapshot in dry-run mode without crashing', async () => {
    fs.writeFileSync(sampleBackupPath, JSON.stringify(sampleBackupData, null, 2));

    try {
      const result = await restoreBackup(sampleBackupPath, true);
      assert.equal(result.success, true);
      assert.equal(result.dryRun, true);
      assert.equal(result.counts.bills, 1);
      assert.equal(result.counts.customers, 1);
      assert.equal(result.counts.staffWorkEntries, 1);
      assert.equal(result.counts.iceRecords, 1);
      assert.equal(result.counts.wastageRecords, 1);
    } finally {
      if (fs.existsSync(sampleBackupPath)) {
        fs.unlinkSync(sampleBackupPath);
      }
    }
  });
});

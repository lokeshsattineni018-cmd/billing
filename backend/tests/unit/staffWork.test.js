const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const StaffWork = require('../../src/models/StaffWork');

describe('StaffWork Model & Calculations Unit Tests', () => {
  it('correctly calculates totalAmount as quantity * price', async () => {
    const entry = new StaffWork({
      staffName: 'Ramesh',
      quantity: 150.5,
      price: 12,
    });
    await entry.validate();
    assert.strictEqual(entry.totalAmount, 1806);
  });

  it('correctly handles fractional prices and rounds to 2 decimals', async () => {
    const entry = new StaffWork({
      staffName: 'Sita',
      quantity: 133.33,
      price: 15.5,
    });
    await entry.validate();
    assert.strictEqual(entry.totalAmount, 2066.62);
  });

  it('sets amountPaid and paymentDate automatically when paymentStatus is Paid', async () => {
    const entry = new StaffWork({
      staffName: 'Lakshmi',
      quantity: 80,
      price: 14,
      paymentStatus: 'Paid',
    });
    await entry.validate();
    assert.strictEqual(entry.totalAmount, 1120);
    assert.strictEqual(entry.amountPaid, 1120);
    assert.ok(entry.paymentDate instanceof Date);
  });

  it('fails validation if staffName is missing', async () => {
    const entry = new StaffWork({
      quantity: 50,
      price: 10,
    });
    await assert.rejects(async () => {
      await entry.validate();
    }, /Staff \/ worker name is required/);
  });

  it('fails validation if quantity is negative', async () => {
    const entry = new StaffWork({
      staffName: 'Raju',
      quantity: -10,
      price: 10,
    });
    await assert.rejects(async () => {
      await entry.validate();
    }, /Quantity cannot be negative/);
  });

  it('fails validation if price is negative', async () => {
    const entry = new StaffWork({
      staffName: 'Raju',
      quantity: 10,
      price: -5,
    });
    await assert.rejects(async () => {
      await entry.validate();
    }, /Price cannot be negative/);
  });
});

const DailyIce = require('../../src/models/DailyIce');
const DailyWastage = require('../../src/models/DailyWastage');

describe('DailyIce Model Unit Tests', () => {
  it('correctly calculates totalAmount as blocks * rate', async () => {
    const ice = new DailyIce({
      blocks: 25,
      rate: 150,
    });
    await ice.validate();
    assert.strictEqual(ice.totalAmount, 3750);
  });

  it('fails validation if blocks or rate is negative', async () => {
    const ice = new DailyIce({
      blocks: -5,
      rate: 100,
    });
    await assert.rejects(async () => {
      await ice.validate();
    }, /Blocks cannot be negative/);
  });
});

describe('DailyWastage Model Unit Tests', () => {
  it('correctly calculates totalAmount as quantityKg * rate for prawn head wastage', async () => {
    const wastage = new DailyWastage({
      category: 'Prawn Head',
      quantityKg: 350.5,
      rate: 14,
    });
    await wastage.validate();
    assert.strictEqual(wastage.totalAmount, 4907);
  });

  it('fails validation if quantityKg or rate is negative', async () => {
    const wastage = new DailyWastage({
      quantityKg: -10,
      rate: 12,
    });
    await assert.rejects(async () => {
      await wastage.validate();
    }, /Quantity cannot be negative/);
  });
});


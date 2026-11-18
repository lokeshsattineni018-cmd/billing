const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { numberToWords } = require('../../src/utils/numberToWords');

describe('numberToWords Currency Conversion Unit Tests (Indian Numbering System)', () => {
  it('handles zero, null, undefined and empty values gracefully', () => {
    assert.equal(numberToWords(0), 'Zero Rupees Only');
    assert.equal(numberToWords(null), 'Zero Rupees Only');
    assert.equal(numberToWords(undefined), 'Zero Rupees Only');
    assert.equal(numberToWords(''), 'Zero Rupees Only');
  });

  it('converts small amounts under 100 accurately', () => {
    assert.equal(numberToWords(7), 'Seven Rupees Only');
    assert.equal(numberToWords(14), 'Fourteen Rupees Only');
    assert.equal(numberToWords(40), 'Forty Rupees Only');
    assert.equal(numberToWords(99), 'Ninety Nine Rupees Only');
  });

  it('converts hundreds and thousands correctly', () => {
    assert.equal(numberToWords(100), 'One Hundred Rupees Only');
    assert.equal(numberToWords(305), 'Three Hundred Five Rupees Only');
    assert.equal(numberToWords(1000), 'One Thousand Rupees Only');
    assert.equal(numberToWords(1580), 'One Thousand Five Hundred Eighty Rupees Only');
    assert.equal(numberToWords(25000), 'Twenty Five Thousand Rupees Only');
  });

  it('converts Lakh and Crore tiers in traditional Indian numbering system', () => {
    assert.equal(numberToWords(100000), 'One Lakh Rupees Only');
    assert.equal(
      numberToWords(1248950),
      'Twelve Lakh Forty Eight Thousand Nine Hundred Fifty Rupees Only'
    );
    assert.equal(
      numberToWords(379476),
      'Three Lakh Seventy Nine Thousand Four Hundred Seventy Six Rupees Only'
    );
    assert.equal(
      numberToWords(15000000),
      'One Crore Fifty Lakh Rupees Only'
    );
    assert.equal(
      numberToWords(20500050),
      'Two Crore Five Lakh Fifty Rupees Only'
    );
  });

  it('ignores fractional paisa correctly by converting the integer rupee part', () => {
    assert.equal(
      numberToWords(5420.75),
      'Five Thousand Four Hundred Twenty Rupees Only'
    );
  });

  it('handles negative numbers safely using absolute value', () => {
    assert.equal(numberToWords(-500), 'Five Hundred Rupees Only');
  });
});

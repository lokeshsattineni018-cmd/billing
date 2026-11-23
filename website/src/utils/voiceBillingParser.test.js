import { describe, it, expect } from 'vitest';
import { parseVoiceBillingText, normalizeVoiceDigits } from './voiceBillingParser';

describe('Voice Billing Speech Parser Unit Tests', () => {
  it('converts Telugu numeral glyphs to ASCII Arabic digits', () => {
    expect(normalizeVoiceDigits('౪౦ కౌంట్ ౮౫ కిలోలు')).toBe('40 కౌంట్ 85 కిలోలు');
  });

  it('correctly parses Telugu spoken weighment string from prompt', () => {
    const input = 'సూర్య ప్రాన్స్, 40 కౌంట్, 85 కిలోలు, రేటు 420';
    const res = parseVoiceBillingText(input);

    expect(res.partyName).toBe('సూర్య ప్రాన్స్');
    expect(res.count).toBe('40');
    expect(res.weight).toBe('85');
    expect(res.rate).toBe('420');
    expect(res.iceQty).toBeNull();
  });

  it('correctly parses English spoken weighment string from prompt', () => {
    const input = 'Kalyani, 60 count, 120 kg, rate 310';
    const res = parseVoiceBillingText(input);

    expect(res.partyName).toBe('Kalyani');
    expect(res.count).toBe('60');
    expect(res.weight).toBe('120');
    expect(res.rate).toBe('310');
  });

  it('correctly parses decimal weights and ice blocks', () => {
    const input = 'Surya Prawns, 40 count, 85.5 kgs, rate 420, 2 ice';
    const res = parseVoiceBillingText(input);

    expect(res.partyName).toBe('Surya Prawns');
    expect(res.count).toBe('40');
    expect(res.weight).toBe('85.5');
    expect(res.rate).toBe('420');
    expect(res.iceQty).toBe('2');
  });

  it('handles item-only voice entry without party name', () => {
    const input = 'count 40, weight 80.25, rate 400';
    const res = parseVoiceBillingText(input);

    expect(res.partyName).toBeNull();
    expect(res.count).toBe('40');
    expect(res.weight).toBe('80.25');
    expect(res.rate).toBe('400');
  });

  it('handles Telugu keywords with alternative words (బరువు, ధర)', () => {
    const input = 'రాయల్ సీ ఫుడ్స్ కౌంట్ 50 బరువు 90 ధర 380';
    const res = parseVoiceBillingText(input);

    expect(res.partyName).toBe('రాయల్ సీ ఫుడ్స్');
    expect(res.count).toBe('50');
    expect(res.weight).toBe('90');
    expect(res.rate).toBe('380');
  });

  it('safely handles empty or blank speech inputs', () => {
    const res = parseVoiceBillingText('');
    expect(res.partyName).toBeNull();
    expect(res.count).toBeNull();
    expect(res.weight).toBeNull();
  });
});

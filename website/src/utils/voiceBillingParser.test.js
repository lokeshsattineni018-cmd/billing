import { describe, it, expect } from 'vitest';
import {
  parseAdvancedVoiceBillingText,
  detectVoiceCommand,
  VOICE_COMMANDS,
} from './voiceBillingParser';
import { convertTeluguWordsToNumber, normalizeSpokenNumbers } from './teluguNumberParser';
import { findBestMatchingCustomer } from './fuzzyMatch';

describe('Advanced Voice Billing Suite Unit Tests', () => {
  describe('Word-to-Number Converter', () => {
    it('converts Telugu words to numbers (tens + units)', () => {
      expect(convertTeluguWordsToNumber('నలభై ఐదు')).toBe('45');
      expect(convertTeluguWordsToNumber('ఎనభై ఐదు')).toBe('85');
      expect(convertTeluguWordsToNumber('అరవై')).toBe('60');
    });

    it('converts hundreds with tens e.g. నాలుగు వందల ఇరవై -> 420', () => {
      expect(convertTeluguWordsToNumber('నాలుగు వందల ఇరవై')).toBe('420');
      expect(convertTeluguWordsToNumber('మూడు వందల పది')).toBe('310');
    });

    it('handles colloquial Telugu fractional half (న్నర -> .5)', () => {
      expect(convertTeluguWordsToNumber('ఎనభై ఐదున్నర')).toBe('85.5');
    });

    it('converts English spoken number words', () => {
      expect(normalizeSpokenNumbers('forty count eighty five kg rate four twenty')).toContain('40 count 85 kg rate 420');
    });
  });

  describe('Voice Commands Detection', () => {
    it('detects Save Bill voice command in English and Telugu', () => {
      expect(detectVoiceCommand('save bill')).toBe(VOICE_COMMANDS.SAVE_BILL);
      expect(detectVoiceCommand('సేవ్ బిల్')).toBe(VOICE_COMMANDS.SAVE_BILL);
      expect(detectVoiceCommand('బిల్ సేవ్ చేయి')).toBe(VOICE_COMMANDS.SAVE_BILL);
    });

    it('detects Add Item voice command', () => {
      expect(detectVoiceCommand('add item')).toBe(VOICE_COMMANDS.ADD_ITEM);
      expect(detectVoiceCommand('మరో ఐటం')).toBe(VOICE_COMMANDS.ADD_ITEM);
      expect(detectVoiceCommand('కొత్త ఐటం')).toBe(VOICE_COMMANDS.ADD_ITEM);
    });

    it('detects Clear Draft voice command', () => {
      expect(detectVoiceCommand('clear bill')).toBe(VOICE_COMMANDS.CLEAR_DRAFT);
      expect(detectVoiceCommand('మొత్తం క్లియర్')).toBe(VOICE_COMMANDS.CLEAR_DRAFT);
    });
  });

  describe('Multi-Item Dictation in One Breath', () => {
    it('parses multiple prawn items + ice in a single sentence', () => {
      const input = 'Surya Prawns... 40 count 85 kg rate 420... and 60 count 110 kg rate 320... and 100 count 45 kg rate 210... 3 ice';
      const res = parseAdvancedVoiceBillingText(input);

      expect(res.partyName).toBe('Surya Prawns');
      expect(res.items.length).toBe(3);

      expect(res.items[0]).toEqual({ count: '40', weight: '85', rate: '420' });
      expect(res.items[1]).toEqual({ count: '60', weight: '110', rate: '320' });
      expect(res.items[2]).toEqual({ count: '100', weight: '45', rate: '210' });
      expect(res.iceQty).toBe('3');
    });

    it('parses multi-item Telugu spoken stream with spoken words', () => {
      const input = 'సూర్య ప్రాన్స్ 40 కౌంట్ 85 కేజీలు రేటు 420 మరియు 60 కౌంట్ 120 కేజీలు రేటు 310 2 ఐస్';
      const res = parseAdvancedVoiceBillingText(input);

      expect(res.partyName).toBe('సూర్య ప్రాన్స్');
      expect(res.items.length).toBe(2);
      expect(res.items[0]).toEqual({ count: '40', weight: '85', rate: '420' });
      expect(res.items[1]).toEqual({ count: '60', weight: '120', rate: '310' });
      expect(res.iceQty).toBe('2');
    });
  });

  describe('Fuzzy Customer Matching', () => {
    const mockCustomers = [
      { companyName: 'Surya Seafoods & Agencies', customerPhone: '9848012345' },
      { companyName: 'Kalyani Prawns Export', customerPhone: '9441400000' },
      { companyName: 'Royal Fisheries', customerPhone: '9988776655' },
    ];

    it('matches "Surya" or "Surya Prawns" to "Surya Seafoods & Agencies"', () => {
      const res = findBestMatchingCustomer('Surya', mockCustomers);
      expect(res.match?.companyName).toBe('Surya Seafoods & Agencies');
      expect(res.score).toBeGreaterThan(0.7);
    });

    it('matches "Kalyan" with typo to "Kalyani Prawns Export"', () => {
      const res = findBestMatchingCustomer('Kalyan', mockCustomers);
      expect(res.match?.companyName).toBe('Kalyani Prawns Export');
      expect(res.score).toBeGreaterThan(0.6);
    });

    it('returns null match for completely unrelated names', () => {
      const res = findBestMatchingCustomer('Random Unknown Person', mockCustomers);
      expect(res.match).toBeNull();
    });
  });
});

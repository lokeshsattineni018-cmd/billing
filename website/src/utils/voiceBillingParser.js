/**
 * Voice Billing Speech Parser for Seafood / Prawn Billing
 * Handles Telugu (te-IN) and English (en-IN / en-US) speech transcripts
 */

const TELUGU_DIGITS = {
  '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
  '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
};

const TELUGU_WORDS_TO_NUM = {
  'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'ఇరవై': 20, 'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50,
  'అరవై': 60, 'డెబ్బై': 70, 'ఎనభై': 80, 'తొంబై': 90, 'వంద': 100
};

export function normalizeVoiceDigits(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;
  for (const [tDigit, aDigit] of Object.entries(TELUGU_DIGITS)) {
    text = text.replaceAll(tDigit, aDigit);
  }
  return text;
}

/**
 * Parses spoken weighment text into structured bill fields:
 * - partyName: Customer / Company name
 * - count: Prawn count (pieces per kg)
 * - weight: Net weight in KG
 * - rate: Rate per KG in INR
 * - iceQty: Ice blocks quantity
 */
export function parseVoiceBillingText(rawText = '') {
  const text = normalizeVoiceDigits(rawText).trim();
  if (!text) {
    return { partyName: null, count: null, weight: null, rate: null, iceQty: null, rawText: '' };
  }

  // 1. Extract Count: e.g. "40 count" or "40 కౌంట్" or "కౌంట్ 40" or "count 40"
  let count = null;
  const countMatch =
    text.match(/(\d+)\s*(?:count|కౌంట్|కౌంటు|pieces)/i) ||
    text.match(/(?:count|కౌంట్|కౌంటు)\s*:?\s*(\d+)/i);
  if (countMatch) {
    count = countMatch[1];
  }

  // 2. Extract Weight: e.g. "85.5 kg" or "85 కిలోలు" or "బరువు 85" or "weight 85"
  let weight = null;
  const weightMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|కిలోలు|కిలో|కేజీలు|కేజీ)/i) ||
    text.match(/(?:weight|బరువు|కేజీలు|కిలోలు)\s*:?\s*(\d+(?:\.\d+)?)/i);
  if (weightMatch) {
    weight = weightMatch[1];
  }

  // 3. Extract Rate: e.g. "rate 420" or "రేటు 420" or "420 rate" or "ధర 420"
  let rate = null;
  const rateMatch =
    text.match(/(?:rate|రేటు|రేట్|ధర|price)\s*:?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:rate|రేటు|రేట్|rupees)/i);
  if (rateMatch) {
    rate = rateMatch[1];
  }

  // 4. Extract Ice Quantity: e.g. "2 ice" or "2 ఐస్" or "ice 2"
  let iceQty = null;
  const iceMatch =
    text.match(/(\d+)\s*(?:ice|ఐస్|మంచు|blocks|బ్లాక్స్)/i) ||
    text.match(/(?:ice|ఐస్)\s*:?\s*(\d+)/i);
  if (iceMatch) {
    iceQty = iceMatch[1];
  }

  // 5. Extract Party Name: everything before the first numeric attribute keyword
  let partyName = null;
  const keywordMatch = text.match(/(?:(?:\d+\s*)?(?:count|కౌంట్|కౌంటు|kg|kgs|kilo|కిలోలు|కేజీలు|బరువు|rate|రేటు|రేట్|ధర|ice|ఐస్))/i);
  let prefix = text;
  if (keywordMatch && keywordMatch.index !== undefined) {
    prefix = text.slice(0, keywordMatch.index);
  }

  // Clean punctuation and common spoken fillers
  let cleanedPrefix = prefix
    .replace(/[,;:\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading filler words like "To", "Party", "Customer", "పేరు"
  cleanedPrefix = cleanedPrefix.replace(/^(?:to|party|customer|buyer|పేరు|పార్టీ)\s*:?/i, '').trim();

  if (cleanedPrefix && cleanedPrefix.length > 1) {
    partyName = cleanedPrefix;
  }

  return {
    partyName,
    count,
    weight,
    rate,
    iceQty,
    rawText: text,
  };
}

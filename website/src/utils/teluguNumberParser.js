/**
 * Telugu & English Spoken Word-to-Number Converter for Aquaculture & Seafood Billing
 * Handles compound words, colloquial fractions (న్నర = .5), hundreds, and spoken hundred shortcuts
 */

const TELUGU_GLYPHS = {
  '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
  '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
};

const TELUGU_BASE_NUMBERS = {
  'సున్నా': 0, 'జీరో': 0,
  'ఒకటి': 1, 'ఒక్కటి': 1, 'ఒక': 1,
  'రెండు': 2, 'రెండో': 2,
  'మూడు': 3,
  'నాలుగు': 4,
  'ఐదు': 5,
  'ఆరు': 6,
  'ఏడు': 7,
  'ఎనిమిది': 8,
  'తొమ్మిది': 9,
  'పది': 10,
  'పదకొండు': 11,
  'పన్నెండు': 12,
  'పదమూడు': 13,
  'పద్నాలుగు': 14,
  'పదిహేను': 15,
  'పదహారు': 16,
  'పదిహేడు': 17,
  'పద్దెనిమిది': 18,
  'పందొమ్మిది': 19,
  'ఇరవై': 20,
  'ముప్పై': 30,
  'నలభై': 40,
  'యాభై': 50,
  'అరవై': 60,
  'డెబ్బై': 70,
  'ఎనభై': 80,
  'తొంబై': 90, 'తొంభై': 90
};

const ENGLISH_DIGITS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9
};

const ENGLISH_TENS = {
  ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const ENGLISH_BASE_NUMBERS = {
  zero: 0, ...ENGLISH_DIGITS, ...ENGLISH_TENS,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
};

export function normalizeGlyphs(text = '') {
  if (!text || typeof text !== 'string') return '';
  let res = text;
  for (const [glyph, digit] of Object.entries(TELUGU_GLYPHS)) {
    res = res.replaceAll(glyph, digit);
  }
  return res;
}

export function convertTeluguWordsToNumber(phrase = '') {
  const clean = phrase.trim();
  if (!clean) return null;

  let fractionAdd = 0;
  let basePhrase = clean;
  if (basePhrase.endsWith('న్నర')) {
    fractionAdd = 0.5;
    basePhrase = basePhrase.replace(/న్నర$/, '').trim();
  } else if (basePhrase.endsWith('ముప్పావు')) {
    fractionAdd = 0.75;
    basePhrase = basePhrase.replace(/ముప్పావు$/, '').trim();
  } else if (basePhrase.endsWith('పావు')) {
    fractionAdd = 0.25;
    basePhrase = basePhrase.replace(/పావు$/, '').trim();
  } else if (basePhrase.endsWith('అర')) {
    fractionAdd = 0.5;
    basePhrase = basePhrase.replace(/అర$/, '').trim();
  }

  if (basePhrase.includes('పాయింట్') || basePhrase.includes('point')) {
    const parts = basePhrase.split(/పాయింట్|point/);
    const intPart = convertTeluguWordsToNumber(parts[0]) || 0;
    const decDigits = parts[1].trim().split(/\s+/).map((w) => {
      if (/^\d+$/.test(w)) return w;
      return TELUGU_BASE_NUMBERS[w] ?? ENGLISH_BASE_NUMBERS[w] ?? w;
    }).join('');
    return String(parseFloat(`${intPart}.${decDigits}`) || intPart);
  }

  const words = basePhrase.split(/\s+/);
  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (/^\d+(\.\d+)?$/.test(w)) {
      current += parseFloat(w);
      matchedAny = true;
      continue;
    }

    if (TELUGU_BASE_NUMBERS[w] !== undefined) {
      current += TELUGU_BASE_NUMBERS[w];
      matchedAny = true;
      continue;
    }

    if (ENGLISH_BASE_NUMBERS[w.toLowerCase()] !== undefined) {
      current += ENGLISH_BASE_NUMBERS[w.toLowerCase()];
      matchedAny = true;
      continue;
    }

    if (/^(వంద|వందలు|వందల|hundred|hundreds)$/i.test(w)) {
      matchedAny = true;
      if (current === 0) current = 1;
      current = current * 100;
      continue;
    }

    if (/^(వేయి|వేలు|వేల|thousand)$/i.test(w)) {
      matchedAny = true;
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      continue;
    }
  }

  total += current;
  if (!matchedAny) return null;

  const finalVal = total + fractionAdd;
  return Number.isInteger(finalVal) ? String(finalVal) : String(finalVal);
}

export function normalizeSpokenNumbers(text = '') {
  if (!text) return '';
  let result = normalizeGlyphs(text);

  // 1. Spoken shortcut hundred pattern e.g. "four twenty" -> "420", "three ten" -> "310"
  const spokenHundredShort = /\b(one|two|three|four|five|six|seven|eight|nine)\s+(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi;
  result = result.replace(spokenHundredShort, (_, h, t) => {
    return String((ENGLISH_DIGITS[h.toLowerCase()] || 0) * 100 + (ENGLISH_TENS[t.toLowerCase()] || 0));
  });

  // 2. English tens + units (e.g. "forty five" -> "45", "eighty five" -> "85")
  const englishTensPattern = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\b/gi;
  result = result.replace(englishTensPattern, (match) => {
    const words = match.toLowerCase().split(/\s+/);
    const val = (ENGLISH_BASE_NUMBERS[words[0]] || 0) + (ENGLISH_BASE_NUMBERS[words[1]] || 0);
    return String(val);
  });

  // 3. Standalone English base numbers
  for (const [word, val] of Object.entries(ENGLISH_BASE_NUMBERS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, String(val));
  }

  // 4. Telugu hundreds compound e.g. "నాలుగు వందల ఇరవై" -> "420"
  const teluguHundredsPattern = /(?:ఒకటి|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది|\d+)?\s*(?:వందల|వందలు|వంద)\s*(?:[^\s,]+)?/g;
  result = result.replace(teluguHundredsPattern, (match) => {
    const num = convertTeluguWordsToNumber(match);
    return num || match;
  });

  // 5. Telugu tens + units compound e.g. "నలభై ఐదు" -> "45"
  const teluguTensPattern = /(?:నలభై|యాభై|అరవై|డెబ్బై|ఎనభై|తొంబై|తొంభై|ఇరవై|ముప్పై)\s+(?:ఒకటి|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది)/g;
  result = result.replace(teluguTensPattern, (match) => {
    const num = convertTeluguWordsToNumber(match);
    return num || match;
  });

  // 6. Standalone Telugu base numbers (Unicode-safe word boundary)
  for (const [word, val] of Object.entries(TELUGU_BASE_NUMBERS)) {
    const regex = new RegExp(`(?<=^|[\\s,;.])${word}(?=$|[\\s,;.])`, 'g');
    result = result.replace(regex, String(val));
  }

  return result;
}

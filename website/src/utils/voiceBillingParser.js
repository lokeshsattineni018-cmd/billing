/**
 * Advanced Multi-Item Voice Billing Speech Parser for Seafood & Prawn Agencies
 * Supports:
 * - Multi-item dictation in a single sentence
 * - Telugu (te-IN) and English (en-IN / en-US) spoken numbers and words
 * - Hands-free voice action commands (Save, Add Item, Clear)
 * - Ice blocks extraction
 */

import { normalizeSpokenNumbers } from './teluguNumberParser.js';

/**
 * Recognized Voice Commands
 */
export const VOICE_COMMANDS = {
  SAVE_BILL: 'SAVE_BILL',
  ADD_ITEM: 'ADD_ITEM',
  CLEAR_DRAFT: 'CLEAR_DRAFT',
};

const COMMAND_PATTERNS = [
  {
    type: VOICE_COMMANDS.SAVE_BILL,
    patterns: [
      /\b(?:save\s*bill|save\s*and\s*print|save\s*invoice|print\s*bill)\b/i,
      /(?:సేవ్\s*బిల్|బిల్\s*సేవ్|సేవ్\s*చేయి|సేవ్\s*చెయ్|ప్రింట్\s*బిల్)/i,
    ],
  },
  {
    type: VOICE_COMMANDS.ADD_ITEM,
    patterns: [
      /\b(?:add\s*item|next\s*item|new\s*item)\b/i,
      /(?:కొత్త\s*ఐటం|మరో\s*ఐటం|ఇంకో\s*ఐటం|తర్వాతి\s*ఐటం)/i,
    ],
  },
  {
    type: VOICE_COMMANDS.CLEAR_DRAFT,
    patterns: [
      /\b(?:clear\s*bill|clear\s*draft|clear\s*all|reset\s*bill)\b/i,
      /(?:మొత్తం\s*క్లియర్|క్లియర్\s*చేయి|బిల్\s*రద్దు|రద్దు\s*చేయి)/i,
    ],
  },
];

export function detectVoiceCommand(text = '') {
  if (!text) return null;
  for (const cmd of COMMAND_PATTERNS) {
    for (const pat of cmd.patterns) {
      if (pat.test(text)) {
        return cmd.type;
      }
    }
  }
  return null;
}

function parseSingleItemSegment(segment = '') {
  const text = segment.trim();
  if (!text) return null;

  // 1. Count
  let count = null;
  const countMatch =
    text.match(/(\d+)\s*(?:count|కౌంట్|కౌంటు|pieces|పీసెస్)/i) ||
    text.match(/(?:count|కౌంట్|కౌంటు)\s*:?\s*(\d+)/i);
  if (countMatch) {
    count = countMatch[1];
  }

  // 2. Weight
  let weight = null;
  const weightMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|కిలోలు|కిలో|కేజీలు|కేజీ)/i) ||
    text.match(/(?:weight|బరువు|కేజీలు|కిలోలు)\s*:?\s*(\d+(?:\.\d+)?)/i);
  if (weightMatch) {
    weight = weightMatch[1];
  }

  // 3. Rate
  let rate = null;
  const rateMatch =
    text.match(/(?:rate|రేటు|రేట్|ధర|price)\s*:?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:rate|రేటు|రేట్|రూపాయలు|rupees)/i);
  if (rateMatch) {
    rate = rateMatch[1];
  }

  // 4. Standalone bare number without keywords (e.g. user said "32" or "260")
  let bareNumber = null;
  if (!count && !weight && !rate) {
    const bareMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    if (bareMatch) {
      bareNumber = bareMatch[1];
    }
  }

  const result = {
    count: count || null,
    weight: weight || null,
    rate: rate || null,
  };
  if (bareNumber) {
    result.bareNumber = bareNumber;
  }

  if (count || weight || rate || bareNumber) {
    return result;
  }
  return null;
}

export function parseAdvancedVoiceBillingText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return {
      command: null,
      partyName: null,
      items: [],
      iceQty: null,
      rawText: '',
    };
  }

  const command = detectVoiceCommand(rawText);
  const normalizedText = normalizeSpokenNumbers(rawText);

  // Extract Ice
  let iceQty = null;
  const iceMatch =
    normalizedText.match(/(\d+)\s*(?:ice|ఐస్|మంచు|blocks|బ్లాక్స్)/i) ||
    normalizedText.match(/(?:ice|ఐస్)\s*:?\s*(\d+)/i);
  if (iceMatch) {
    iceQty = iceMatch[1];
  }

  // Extract Party Name
  let partyName = null;
  const firstItemMatch = normalizedText.match(
    /(?:(?:\d+\s*)?(?:count|కౌంట్|కౌంటు|kg|kgs|kilo|కిలోలు|కేజీలు|బరువు|rate|రేటు|రేట్|ధర|ice|ఐస్))/i
  );

  let remainingText = normalizedText;
  if (firstItemMatch && firstItemMatch.index !== undefined) {
    const rawPrefix = normalizedText.slice(0, firstItemMatch.index);
    let cleanedPrefix = rawPrefix
      .replace(/[,;:\-_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    cleanedPrefix = cleanedPrefix
      .replace(/^(?:to|party|customer|buyer|పేరు|పార్టీ)\s*:?/i, '')
      .replace(/[.\s,]+$/, '')
      .trim();

    if (cleanedPrefix && cleanedPrefix.length > 1 && !/^\d+$/.test(cleanedPrefix)) {
      partyName = cleanedPrefix;
    }

    remainingText = normalizedText.slice(firstItemMatch.index);
  }

  const textWithoutIce = remainingText.replace(/(?:\d+\s*)?(?:ice|ఐస్|మంచు|blocks|బ్లాక్స్)\s*(?:\d+)?/gi, '');

  // Multi-item splitting: Unicode & English safe
  const itemSplitPattern = /(?:(?:^|\s+)(?:and|మళ్లీ|మరియు|ఇంకో|తరువాత|నెక్స్ట్)(?:\s+|$)|[,;]|\.\s+)(?=\s*(?:\d+\s*(?:count|కౌంట్)|(?:count|కౌంట్)))/i;

  let rawSegments = textWithoutIce.split(itemSplitPattern);

  if (rawSegments.length <= 1) {
    const countSplitRegex = /(?<=\d+\s*(?:rate|రేటు|రేట్|ధర)?\s+)(?=\d+\s*(?:count|కౌంట్)|(?:count|కౌంట్)\s*\d+)/gi;
    rawSegments = textWithoutIce.split(countSplitRegex);
  }

  const items = [];
  for (const seg of rawSegments) {
    const parsedSeg = parseSingleItemSegment(seg);
    if (parsedSeg && (parsedSeg.count || parsedSeg.weight || parsedSeg.rate)) {
      items.push(parsedSeg);
    }
  }

  const primaryItem = items[0] || {};

  return {
    command,
    partyName,
    items,
    count: primaryItem.count || null,
    weight: primaryItem.weight || null,
    rate: primaryItem.rate || null,
    iceQty,
    rawText,
    normalizedText,
  };
}

export const parseVoiceBillingText = parseAdvancedVoiceBillingText;

/**
 * Fuzzy Customer Name Matcher for Voice Billing
 * Matches spoken customer names against saved directory customers
 */

export function levenshteinDistance(s1 = '', s2 = '') {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculates similarity ratio between 0 and 1
 */
export function stringSimilarity(str1 = '', str2 = '') {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Exact substring check gives high boost
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.8 + 0.2 * (minLen / maxLen);
  }

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Finds the closest matching customer from a list
 * @param {string} spokenName - Name transcribed from speech
 * @param {Array} customersList - Array of customer objects from DB
 * @param {number} threshold - Minimum score to qualify as match (default 0.55)
 */
export function findBestMatchingCustomer(spokenName, customersList = [], threshold = 0.55) {
  if (!spokenName || !customersList || customersList.length === 0) {
    return { match: null, score: 0, isHighConfidence: false };
  }

  const cleanSpoken = spokenName.toLowerCase().replace(/[^a-z0-9\u0C00-\u0C7F\s]/gi, '').trim();
  const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);

  let bestMatch = null;
  let highestScore = 0;

  for (const customer of customersList) {
    const target = (customer.companyName || '').toLowerCase().trim();
    if (!target) continue;

    // 1. Direct equality
    if (target === cleanSpoken) {
      return { match: customer, score: 1.0, isHighConfidence: true };
    }

    // 2. Full string similarity
    const fullSim = stringSimilarity(cleanSpoken, target);

    // 3. Token-level overlap (e.g. "Surya" matches "Surya Prawns & Agencies")
    const targetTokens = target.split(/\s+/).filter(Boolean);
    let tokenOverlapCount = 0;

    for (const sTok of spokenTokens) {
      for (const tTok of targetTokens) {
        if (sTok === tTok || stringSimilarity(sTok, tTok) >= 0.8) {
          tokenOverlapCount++;
          break;
        }
      }
    }

    const tokenScore = spokenTokens.length > 0 ? tokenOverlapCount / spokenTokens.length : 0;
    const compositeScore = Math.max(fullSim, tokenScore * 0.9);

    if (compositeScore > highestScore) {
      highestScore = compositeScore;
      bestMatch = customer;
    }
  }

  if (highestScore >= threshold && bestMatch) {
    return {
      match: bestMatch,
      score: highestScore,
      isHighConfidence: highestScore >= 0.75,
    };
  }

  return { match: null, score: highestScore, isHighConfidence: false };
}

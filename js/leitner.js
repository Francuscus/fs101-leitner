// ============================================================
//  leitner.js — Box logic, fuzzy matching, deck management
// ============================================================

const LEITNER = (() => {

  // Box review intervals in days (index = box number)
  const INTERVALS = {
    3: [0, 1, 7, 30],
    5: [0, 1, 3, 7, 14, 30],
  };

  // ── FUZZY MATCHING ─────────────────────────────────────────
  function normalize(s) {
    return String(s).toLowerCase().trim()
      .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o')
      .replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({length: m + 1}, (_, i) =>
      Array.from({length: n + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        d[i][j] = a[i-1] === b[j-1]
          ? d[i-1][j-1]
          : 1 + Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]);
    return d[m][n];
  }

  function fuzzyMatch(typed, correct) {
    if (!typed || !correct) return false;
    const t = normalize(typed);
    const c = normalize(correct);
    if (t === c) return true;
    // Split on slashes, commas, parens — check each alternative
    const alts = c.split(/[\/,()\[\]]+/).map(s => s.trim()).filter(Boolean);
    for (const alt of alts) {
      if (t === alt) return true;
      const maxDist = Math.max(2, Math.floor(alt.length * 0.25));
      if (levenshtein(t, alt) <= maxDist) return true;
    }
    return false;
  }

  // ── DUE CARD CALCULATION ───────────────────────────────────
  function getDueCards(deck, tier, vocab) {
    const intervals = INTERVALS[tier] || INTERVALS[5];
    const now = Date.now();

    // Build vocab lookup
    const vmap = {};
    vocab.forEach(w => { vmap[w.id] = w; });

    return deck
      .filter(card => {
        const box = parseInt(card.box) || 1;
        if (box >= intervals.length) return false; // mastered
        const intervalMs = intervals[box] * 86400000;
        if (intervalMs === 0) return true; // Box 1 = always due
        const lastReview = new Date(card.timestamp).getTime();
        return (now - lastReview) >= intervalMs;
      })
      .map(card => {
        const v = vmap[card.wordId] || {};
        return {
          wordId:       card.wordId,
          spanish:      v.spanish   || card.spanish,
          english:      v.english   || '',
          direction:    card.direction,
          box:          parseInt(card.box) || 1,
          streak:       card.streak || 0,
          intervention: card.intervention || 0,
          chapter:      v.chapter || '',
          group:        v.group || '',
        };
      });
  }

  // ── BOX MOVEMENT ───────────────────────────────────────────
  function calcNewBox(boxBefore, result, tier) {
    const max = parseInt(tier) || 5;
    if (result === 'PASS') return Math.min(boxBefore + 1, max);
    return 1;
  }

  function calcNewIntervention(intBefore, result, streak, consecutiveFails) {
    if (result === 'FAIL') {
      if (consecutiveFails >= 6) return 3;
      if (consecutiveFails >= 4) return 2;
      if (consecutiveFails >= 2) return 1;
      return intBefore;
    }
    // PASS — de-escalate after 3-streak
    if (streak >= 3 && intBefore > 0) return Math.max(0, intBefore - 1);
    return intBefore;
  }

  // ── INTERVENTION MESSAGES ──────────────────────────────────
  const INT_MESSAGES = [
    '',
    '📝 Make a handmade card — draw the word by hand, sketch an image on the back',
    '🎨 Sculpt or draw this word — make it physical',
    '🪞 Mirror activity — stand up, act out the word, then sketch what you saw',
  ];

  function getIntMessage(level) {
    return INT_MESSAGES[Math.min(level, 3)] || '';
  }

  // ── PRE-TEST WORD SELECTION ────────────────────────────────
  function getPreTestWords(vocab, count = 25) {
    // Only numbered words (ID starts with V, no P suffix)
    return vocab
      .filter(w => w.id && w.id.charAt(0) === 'V' && !w.id.includes('P'))
      .slice(0, count);
  }

  // ── BOX STATS ──────────────────────────────────────────────
  function getBoxStats(deck, tier) {
    const max = parseInt(tier) || 5;
    const stats = {};
    for (let i = 1; i <= max; i++) stats[i] = 0;
    stats.mastered = 0;

    deck.forEach(card => {
      const box = parseInt(card.box) || 1;
      if (box >= max) stats.mastered++;
      else stats[box] = (stats[box] || 0) + 1;
    });
    return stats;
  }

  return {
    fuzzyMatch,
    normalize,
    getDueCards,
    calcNewBox,
    calcNewIntervention,
    getIntMessage,
    getPreTestWords,
    getBoxStats,
    INTERVALS,
  };
})();

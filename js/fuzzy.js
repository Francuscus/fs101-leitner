// ============================================================
//  fuzzy.js — Fuzzy answer matching
//  Handles accents, spelling errors, multiple alternatives
// ============================================================

function normalize(s) {
  return s.toLowerCase().trim()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({length: m+1}, (_, i) => [i]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i-1] === b[j-1]
        ? d[i-1][j-1]
        : 1 + Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]);
    }
  }
  return d[m][n];
}

function fuzzyMatch(typed, correct) {
  if (!typed || !correct) return false;
  const t = normalize(typed);
  const c = normalize(correct);
  if (t === c) return true;

  // Split correct answer on /, comma, parentheses — check each alternative
  const alts = c.split(/[\/,()]+/).map(s => s.trim()).filter(Boolean);
  for (const alt of alts) {
    if (t === alt) return true;
    // Allow up to 25% edit distance, minimum 2 characters
    const threshold = Math.max(2, Math.floor(alt.length * 0.25));
    if (levenshtein(t, alt) <= threshold) return true;
  }
  return false;
}

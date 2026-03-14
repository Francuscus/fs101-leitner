// ============================================================
//  quiz.js — Leitner box logic, deck management, intervals
// ============================================================

const BOX_INTERVALS = {
  3: [0, 1, 7, 30],
  5: [0, 1, 3, 7, 14, 30],
};

const Quiz = (() => {

  // Given a deck (array of card states) and tier, return cards due today
  function getDueCards(deck, tier) {
    const intervals = BOX_INTERVALS[tier] || BOX_INTERVALS[5];
    const now = Date.now();
    return deck.filter(card => {
      const box = parseInt(card.box) || 1;
      if (box >= intervals.length) return false; // mastered
      const days = intervals[box];
      if (days === 0) return true; // box 1 always due
      const lastMs = card.timestamp ? new Date(card.timestamp).getTime() : 0;
      const daysSince = (now - lastMs) / 86400000;
      return daysSince >= days;
    });
  }

  // Calculate new box after a result
  function newBox(currentBox, result, tier) {
    const max = parseInt(tier) || 5;
    if (result === 'PASS') return Math.min(parseInt(currentBox) + 1, max);
    return 1;
  }

  // Calculate new intervention level
  function newIntervention(currentInt, result, streak, consecutiveFails) {
    if (result === 'FAIL') {
      if (consecutiveFails >= 6) return 3;
      if (consecutiveFails >= 4) return 2;
      if (consecutiveFails >= 2) return 1;
      return currentInt;
    }
    // De-escalate after 3 consecutive passes
    if (streak >= 3 && currentInt > 0) return Math.max(0, currentInt - 1);
    return currentInt;
  }

  // Intervention messages
  const INT_MESSAGES = [
    '',
    '📝 Make a handmade card — draw the Spanish word on the front, English + your own image on the back',
    '🎨 Sculpt or draw this word — then photograph your creation',
    '🪞 Mirror activity — act out the word, then sketch what you saw',
  ];

  function interventionMessage(level) {
    return INT_MESSAGES[level] || '';
  }

  // Build the two cards (ES→EN and EN→ES) for a vocab word
  function makeCards(word, esBox = 1, enBox = 1, esInt = 0, enInt = 0) {
    return [
      {
        wordId: word.id, spanish: word.spanish, english: word.english,
        chapter: word.chapter, group: word.group,
        direction: 'ES→EN', box: esBox, intervention: esInt,
        streak: 0, timestamp: null,
      },
      {
        wordId: word.id, spanish: word.spanish, english: word.english,
        chapter: word.chapter, group: word.group,
        direction: 'EN→ES', box: enBox, intervention: enInt,
        streak: 0, timestamp: null,
      },
    ];
  }

  // Merge fresh deck state from server into local cards
  function applyDeckState(cards, deckState) {
    const map = {};
    deckState.forEach(s => { map[s.wordId + '|' + s.direction] = s; });
    return cards.map(card => {
      const key = card.wordId + '|' + card.direction;
      return map[key] ? { ...card, ...map[key] } : card;
    });
  }

  return { getDueCards, newBox, newIntervention, interventionMessage, makeCards, applyDeckState };
})();

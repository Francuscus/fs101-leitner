// ============================================================
//  app.js — Main application state and screen routing
//  FS-101 Leitner Box | Prof. Cipriani | Monmouth University
// ============================================================

// ── STATE ─────────────────────────────────────────────────────
const S = {
  // Student identity
  name: '', className: '', studentId: '', tier: 5,

  // Pre-test
  preWords: [], preRound: 1, preIdx: 0, preResults: [],

  // Review session
  deck: [],         // full merged deck from server
  dueCards: [],     // cards due today
  revIdx: 0,
  revSession: [],   // results this session
  sessionNum: 1,

  // Speech state per card
  spokenAnswer: '',
  inputMode: 'type', // 'type' or 'speak'

  // Personal translations bank: { 'wordId': ['alt1','alt2'] }
  myTranslations: {},
};

// ── SCREEN ROUTER ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ── LOGIN ──────────────────────────────────────────────────────
function loginStudent() {
  const name = document.getElementById('inName').value.trim();
  const cls  = document.getElementById('inClass').value;
  if (!name || !cls) { alert('Please enter your name and select your class.'); return; }

  S.name = name;
  S.className = cls;
  S.studentId = name.toLowerCase().replace(/\s+/g, '_') + '_' + cls;

  localStorage.setItem('fs101_name', name);
  localStorage.setItem('fs101_class', cls);

  showScreen('screenLoading');
  setLoadingMsg('Looking up your deck…');

  Api.getDeck(S.studentId)
    .then(deck => {
      // Load personal translations in parallel
      Api.getTranslations(S.studentId)
        .then(trans => {
          S.myTranslations = {};
          (trans || []).forEach(t => {
            if (!S.myTranslations[t.wordId]) S.myTranslations[t.wordId] = [];
            S.myTranslations[t.wordId].push(t.translation);
          });
        })
        .catch(() => {}); // non-fatal

      if (deck && deck.length > 0) {
        S.deck = deck;
        goToDashboard();
      } else {
        showScreen('screenTier');
      }
    })
    .catch(() => showScreen('screenTier'));
}

// ── TIER SELECTION ─────────────────────────────────────────────
function selectTier(t) {
  S.tier = t;
  document.getElementById('tier3card').classList.toggle('selected', t === 3);
  document.getElementById('tier5card').classList.toggle('selected', t === 5);
}

// ── PRE-TEST ───────────────────────────────────────────────────
function startPreTest() {
  showScreen('screenLoading');
  setLoadingMsg('Loading vocabulary…');

  Api.getPreTestWords()
    .then(words => {
      console.log('getPreTestWords returned:', words);
      if (!words || words.length === 0) {
        alert('Could not load vocabulary. Server returned empty list. Please tell Prof. Cipriani to check the Apps Script execution log.');
        showScreen('screenTier');
        return;
      }
      S.preWords   = words;
      S.preRound   = 1;
      S.preIdx     = 0;
      S.preResults = words.map(w => ({
        wordId: w.id, spanish: w.spanish, english: w.english, chapter: w.chapter,
        resultES: '', typedES: '', resultEN: '', typedEN: '',
      }));
      showScreen('screenPreCard');
      renderPreCard();
    })
    .catch(e => {
      alert('Error loading words: ' + e.message);
      showScreen('screenTier');
    });
}

function renderPreCard() {
  if (!S.preWords || S.preWords.length === 0) {
    alert('No vocabulary loaded. Please tell Prof. Cipriani.');
    return;
  }
  const w   = S.preWords[S.preIdx];
  const tot = S.preWords.length;
  const pct = ((S.preIdx + (S.preRound - 1) * tot) / (tot * 2)) * 100;

  document.getElementById('preProgress').style.width = pct + '%';
  document.getElementById('preCountLabel').textContent = (S.preIdx + 1) + ' / ' + tot;
  document.getElementById('preRoundLabel').textContent = 'Round ' + S.preRound + ' of 2';

  if (S.preRound === 1) {
    document.getElementById('preDirection').textContent = 'ESPAÑOL → ENGLISH';
    document.getElementById('prePrompt').textContent    = w.spanish;
    document.getElementById('preHint').textContent      = 'Type or speak the English translation';
  } else {
    document.getElementById('preDirection').textContent = 'ENGLISH → ESPAÑOL';
    document.getElementById('prePrompt').textContent    = w.english;
    document.getElementById('preHint').textContent      = 'Escribe o di la palabra en español';
  }

  document.getElementById('preAnswer').value   = '';
  document.getElementById('preFeedback').textContent = '';
  document.getElementById('preFeedback').className   = 'feedback';
  document.getElementById('preNextBtn').disabled     = true;
  document.getElementById('preInterim').textContent  = '';
  document.getElementById('preAddTranslationRow').style.display = 'none';
  resetMicBtn('preMicBtn');
  S.spokenAnswer = '';
  S.inputMode    = 'type';

  document.getElementById('preAnswer').focus();
}

function checkPreAnswer(typed) {
  const w       = S.preWords[S.preIdx];
  const correct = S.preRound === 1 ? w.english : w.spanish;
  const pass    = fuzzyMatchWithPersonal(typed, correct, w.id);
  const fb      = document.getElementById('preFeedback');

  fb.textContent = pass ? '✓ Correct!' : '✗  ' + correct;
  fb.className   = 'feedback ' + (pass ? 'correct' : 'wrong');

  if (S.preRound === 1) {
    S.preResults[S.preIdx].resultES = pass ? 'PASS' : 'FAIL';
    S.preResults[S.preIdx].typedES  = typed;
  } else {
    S.preResults[S.preIdx].resultEN = pass ? 'PASS' : 'FAIL';
    S.preResults[S.preIdx].typedEN  = typed;
  }
  document.getElementById('preNextBtn').disabled = false;
  document.getElementById('preAddTranslationRow').style.display = 'block';
}

function submitPreAnswer() {
  const typed = document.getElementById('preAnswer').value.trim();
  if (!typed && !S.spokenAnswer) return;
  checkPreAnswer(typed || S.spokenAnswer);
}

function nextPreCard() {
  Speech.stop();
  S.preIdx++;
  if (S.preIdx >= S.preWords.length) {
    if (S.preRound === 1) { S.preRound = 2; S.preIdx = 0; renderPreCard(); }
    else { finishPreTest(); }
  } else {
    renderPreCard();
  }
}

function finishPreTest() {
  let passES = 0, passEN = 0;
  S.preResults.forEach(r => {
    if (r.resultES === 'PASS') passES++;
    if (r.resultEN === 'PASS') passEN++;
  });
  const tot = S.preWords.length;
  const b1  = S.preResults.reduce((n,r) => n + (r.resultES==='FAIL'?1:0) + (r.resultEN==='FAIL'?1:0), 0);
  const b2  = S.preResults.reduce((n,r) => n + (r.resultES==='PASS'?1:0) + (r.resultEN==='PASS'?1:0), 0);

  document.getElementById('preScoreBig').textContent = (passES + passEN) + ' / ' + (tot * 2);
  document.getElementById('preScoreSub').textContent =
    'correct (' + passES + ' Spanish→English, ' + passEN + ' English→Spanish)';

  let gridHtml = '';
  const labels = ['Learning','Started','','','Mastered'];
  [b1, b2, 0, 0, 0].forEach((n, i) => {
    gridHtml += `<div class="box-cell b${i+1}">
      <div class="box-num">${n}</div>
      <div class="box-count">Box ${i+1}<br>${labels[i]}</div>
    </div>`;
  });
  document.getElementById('preBoxGrid').innerHTML = gridHtml;
  document.getElementById('preResultNote').textContent =
    'Each word has two independent cards — one per direction. ' +
    'Cards you knew go to Box 2. Cards you missed start in Box 1.';

  showScreen('screenPreResults');

  // Save to sheet in background
  Api.savePreTest({
    studentId: S.studentId, studentName: S.name, className: S.className,
    tier: S.tier, results: S.preResults,
    preTestScore: (passES + passEN) + '/' + (tot * 2),
    totalWords: tot * 2,
  }).catch(e => console.warn('savePreTest error:', e));
}

// ── DASHBOARD ──────────────────────────────────────────────────
function goToDashboard() {
  showScreen('screenLoading');
  setLoadingMsg('Loading your deck…');

  Api.getDeck(S.studentId)
    .then(deck => {
      S.deck = deck || [];
      S.dueCards = Quiz.getDueCards(S.deck, S.tier);

      document.getElementById('dashName').textContent = S.name + ' — Class ' + S.className;
      document.getElementById('dashSub').textContent  =
        'Tier: ' + S.tier + '-Box  ·  ' + S.deck.length + ' total cards  ·  ' + S.dueCards.length + ' due today';
      document.getElementById('dashDue').textContent  = S.dueCards.length;

      // Box breakdown from full deck
      const boxes = {1:0, 2:0, 3:0, 4:0, 5:0};
      S.deck.forEach(c => { const b = Math.min(parseInt(c.box)||1, 5); boxes[b]++; });
      let gridHtml = '';
      for (let i = 1; i <= 5; i++) {
        gridHtml += `<div class="box-cell b${i}">
          <div class="box-num">${boxes[i]}</div>
          <div class="box-count">Box ${i}</div>
        </div>`;
      }
      document.getElementById('dashBoxGrid').innerHTML = gridHtml;

      const btn = document.getElementById('reviewBtn');
      btn.disabled    = S.dueCards.length === 0;
      btn.textContent = S.dueCards.length > 0
        ? '🃏  Review ' + S.dueCards.length + ' Due Cards'
        : '✓  All caught up — come back tomorrow!';

      showScreen('screenDash');
    })
    .catch(e => {
      alert('Error loading deck: ' + e.message);
      showScreen('screenTier');
    });
}

// ── REVIEW SESSION ─────────────────────────────────────────────
function startReview() {
  S.revIdx     = 0;
  S.revSession = [];
  S.sessionNum++;
  showScreen('screenReview');
  renderRevCard();
}

function renderRevCard() {
  if (S.revIdx >= S.dueCards.length) { finishSession(); return; }

  const c   = S.dueCards[S.revIdx];
  const tot = S.dueCards.length;

  document.getElementById('revProgress').style.width = ((S.revIdx / tot) * 100) + '%';
  document.getElementById('revCount').textContent    = (S.revIdx + 1) + ' / ' + tot;
  document.getElementById('revLabel').textContent    = 'Review — Box ' + (c.box || 1);
  document.getElementById('revDirection').textContent = c.direction;

  const isES = c.direction === 'ES→EN';
  document.getElementById('revPrompt').textContent  = isES ? c.spanish : c.english;
  document.getElementById('revAnswer').textContent  = isES ? c.english : c.spanish;
  document.getElementById('revHint').textContent    = isES
    ? 'Type or speak the English translation'
    : 'Escribe o di la palabra en español';

  document.getElementById('revCard').classList.remove('revealed', 'correct-flash', 'wrong-flash');
  document.getElementById('revInput').value     = '';
  document.getElementById('revFeedback').textContent = '';
  document.getElementById('revFeedback').className   = 'feedback';
  document.getElementById('revButtons').style.display = 'none';
  document.getElementById('addTranslationRow').style.display = 'none';
  document.getElementById('intBanner').classList.remove('visible');
  document.getElementById('revInterim').textContent   = '';
  resetMicBtn('revMicBtn');
  S.spokenAnswer = '';
  S.inputMode    = 'type';

  // Auto-speak the prompt in the target language
  if (Speech.synthSupported()) {
    const lang = isES ? 'es-AR' : 'en-US';
    setTimeout(() => Speech.speak(isES ? c.spanish : c.english, lang), 300);
  }

  document.getElementById('revInput').focus();
}

function checkRevAnswer(typed) {
  const c       = S.dueCards[S.revIdx];
  const correct = c.direction === 'ES→EN' ? c.english : c.spanish;
  const pass    = fuzzyMatchWithPersonal(typed, correct, c.wordId);
  const fb      = document.getElementById('revFeedback');
  const card    = document.getElementById('revCard');

  card.classList.add('revealed');
  card.classList.add(pass ? 'correct-flash' : 'wrong-flash');
  document.getElementById('addTranslationRow').style.display = 'block';

  if (pass) {
    fb.textContent = '✓  Correct!';
    fb.className   = 'feedback correct';
    submitRevResult('PASS', typed);
  } else {
    fb.innerHTML   = `✗ &nbsp;Answer: <strong>${correct}</strong>`;
    fb.className   = 'feedback wrong';
    document.getElementById('revButtons').style.display = 'block';
  }
}

function submitRevResult(result, typed) {
  Speech.stop();
  const c        = S.dueCards[S.revIdx];
  const answer   = typed || document.getElementById('revInput').value.trim() || S.spokenAnswer;
  const newBox   = Quiz.newBox(c.box || 1, result, S.tier);
  const newInt   = Quiz.newIntervention(c.intervention || 0, result,
                     result === 'PASS' ? (c.streak || 0) + 1 : 0,
                     result === 'FAIL' ? (c.consecutiveFails || 0) + 1 : 0);
  const intMsg   = Quiz.interventionMessage(newInt);

  S.revSession.push({
    word: c.spanish, english: c.english,
    direction: c.direction, result,
    box: c.box || 1, newBox,
    inputMode: S.inputMode,
  });

  if (intMsg && newInt > (c.intervention || 0)) {
    const banner = document.getElementById('intBanner');
    banner.textContent = intMsg;
    banner.classList.add('visible');
    setTimeout(() => { S.revIdx++; renderRevCard(); }, 2500);
  } else {
    S.revIdx++;
    renderRevCard();
  }

  // Save in background
  Api.saveResult({
    studentId: S.studentId, studentName: S.name, className: S.className,
    wordId: c.wordId, spanish: c.spanish, chapter: c.chapter || '',
    direction: c.direction, boxBefore: c.box || 1,
    interventionBefore: c.intervention || 0,
    result, typed: answer, tier: S.tier,
    streakBefore: c.streak || 0, sessionNumber: S.sessionNum,
    inputMode: S.inputMode,
  }).catch(e => console.warn('saveResult error:', e));
}

// ── SESSION COMPLETE ───────────────────────────────────────────
function finishSession() {
  const pass = S.revSession.filter(r => r.result === 'PASS').length;
  const tot  = S.revSession.length;

  document.getElementById('doneScore').textContent = pass + ' / ' + tot;
  document.getElementById('doneSub').textContent   = 'cards correct this session';

  let html = '';
  S.revSession.slice(0, 12).forEach(r => {
    const modeTag = r.inputMode === 'speak'
      ? '<span class="badge badge-speech">🎤</span> '
      : '';
    html += `<div class="result-row">
      <span>${r.word} (${r.direction})</span>
      <span>
        ${modeTag}
        <span class="badge badge-box">Box ${r.box}→${r.newBox}</span>
        <span class="badge ${r.result === 'PASS' ? 'badge-pass' : 'badge-fail'}">${r.result}</span>
      </span>
    </div>`;
  });
  if (S.revSession.length > 12) {
    html += `<p class="note" style="text-align:center;margin-top:8px">…and ${S.revSession.length - 12} more cards</p>`;
  }
  document.getElementById('doneResults').innerHTML = html;
  showScreen('screenDone');
}

// ── PERSONAL TRANSLATION HELPERS ──────────────────────────────
function addMyTranslationPre() {
  const w         = S.preWords[S.preIdx];
  const direction = S.preRound === 1 ? 'ES→EN' : 'EN→ES';
  addMyTranslation(w.id, w.spanish, direction);
}

function fuzzyMatchWithPersonal(typed, correct, wordId) {
  if (fuzzyMatch(typed, correct)) return true;
  const personal = S.myTranslations[wordId] || [];
  return personal.some(alt => fuzzyMatch(typed, alt));
}

function addMyTranslation(wordId, spanish, direction) {
  const langLabel = direction === 'ES→EN' ? 'English' : 'Spanish';
  const translation = prompt('Add your own accepted translation for: "' + spanish + '" -- Type your preferred ' + langLabel + ' translation:');
  if (!translation || !translation.trim()) return;

  const trimmed = translation.trim();

  // Save to local state immediately
  if (!S.myTranslations[wordId]) S.myTranslations[wordId] = [];
  if (!S.myTranslations[wordId].includes(trimmed)) {
    S.myTranslations[wordId].push(trimmed);
  }

  // Save to sheet in background
  Api.saveTranslation({
    studentId:   S.studentId,
    studentName: S.name,
    wordId:      wordId,
    spanish:     spanish,
    translation: trimmed,
  }).catch(e => console.warn('saveTranslation error:', e));

  // Show confirmation
  const banner = document.getElementById('intBanner');
  banner.textContent = '✓ Translation saved: "' + trimmed + '" is now accepted for this word.';
  banner.classList.add('visible');
  setTimeout(() => banner.classList.remove('visible'), 3000);
}

// ── SPEECH HELPERS ─────────────────────────────────────────────
function toggleMic(inputId, micBtnId, interimId, lang) {
  if (Speech.isListening()) {
    Speech.stop();
    resetMicBtn(micBtnId);
    return;
  }
  if (!Speech.supported()) {
    alert('Speech recognition requires Chrome. Please use Chrome or type your answer.');
    return;
  }
  S.inputMode    = 'speak';
  S.spokenAnswer = '';
  const micBtn   = document.getElementById(micBtnId);
  const interim  = document.getElementById(interimId);
  const input    = document.getElementById(inputId);
  micBtn.classList.add('listening');
  micBtn.textContent = '⏹  Stop';
  interim.textContent = '🎤 Listening…';
  interim.className   = 'interim-text';

  Speech.listen({
    lang,
    onResult: (transcript, isFinal) => {
      interim.textContent = transcript;
      if (isFinal) {
        interim.className   = 'interim-text final';
        S.spokenAnswer      = transcript;
        input.value         = transcript;
        resetMicBtn(micBtnId);
        // Auto-submit on final result
        if (inputId === 'preAnswer') checkPreAnswer(transcript);
        if (inputId === 'revInput')  checkRevAnswer(transcript);
      }
    },
    onEnd: () => resetMicBtn(micBtnId),
    onError: (err) => {
      interim.textContent = 'Error: ' + err + '. Please try again or type your answer.';
      resetMicBtn(micBtnId);
    },
  });
}

function resetMicBtn(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.remove('listening');
  btn.textContent = '🎤  Speak';
}

// ── LOADING SCREEN ─────────────────────────────────────────────
function setLoadingMsg(msg) {
  const el = document.getElementById('loadingMsg');
  if (el) el.textContent = msg;
}

// ── AUTO-LOGIN ──────────────────────────────────────────────────
window.addEventListener('load', () => {
  const name = localStorage.getItem('fs101_name');
  const cls  = localStorage.getItem('fs101_class');
  if (name && cls) {
    document.getElementById('inName').value  = name;
    document.getElementById('inClass').value = cls;
    S.name      = name;
    S.className = cls;
    S.studentId = name.toLowerCase().replace(/\s+/g, '_') + '_' + cls;
    showScreen('screenLoading');
    setLoadingMsg('Welcome back, ' + name + '…');
    Api.getDeck(S.studentId)
      .then(deck => {
        if (deck && deck.length > 0) { S.deck = deck; goToDashboard(); }
        else showScreen('screenLogin');
      })
      .catch(() => showScreen('screenLogin'));
  }
});

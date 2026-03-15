// ── MY CARDS VIEW ─────────────────────────────────────────────
function showMyCards() {
  var deck = S.deck;
  if (!deck || deck.length === 0) {
    alert('No cards in your deck yet. Complete the pre-test first.');
    return;
  }

  var boxNames  = {1:'Learning', 2:'Getting There', 3:'Almost There', 4:'Nearly Mastered', 5:'Mastered'};
  var boxColors = {1:'#FDF0F0', 2:'#FEF9E7', 3:'#EBF3FB', 4:'#EBF7ED', 5:'#F5EEF8'};
  var boxText   = {1:'#7B2C2C', 2:'#7D6608', 3:'#1F4E79', 4:'#1E6B2E', 5:'#4A235A'};

  var boxes = {1:[], 2:[], 3:[], 4:[], 5:[]};
  deck.forEach(function(card) {
    var b = Math.min(parseInt(card.box) || 1, 5);
    boxes[b].push(card);
  });

  Object.keys(boxes).forEach(function(b) {
    boxes[b].sort(function(a, c) { return a.spanish.localeCompare(c.spanish); });
  });

  // Build tab buttons
  var tabHtml = '';
  for (var i = 1; i <= 5; i++) {
    tabHtml += '<button class="box-tab-btn" id="boxTab' + i + '"' +
      ' style="width:auto;padding:5px 12px;font-size:12px;border-radius:8px;border:1.5px solid ' + boxText[i] + ';' +
      'background:' + boxColors[i] + ';color:' + boxText[i] + ';cursor:pointer;font-family:inherit;font-weight:600;margin-right:4px;margin-bottom:4px"' +
      ' onclick="filterMyCards(' + i + ')">' +
      'Box ' + i + ' (' + boxes[i].length + ')</button>';
  }
  document.getElementById('boxTabs').innerHTML = tabHtml;

  window._mcBoxes  = boxes;
  window._mcNames  = boxNames;
  window._mcColors = boxColors;
  window._mcText   = boxText;

  document.getElementById('myCardsTitle').textContent = S.name + ' — ' + deck.length + ' cards total';
  renderMyCards(0);
  showScreen('screenMyCards');
}

function filterMyCards(boxNum) {
  for (var i = 1; i <= 5; i++) {
    var tab = document.getElementById('boxTab' + i);
    if (tab) tab.style.fontWeight = (i === boxNum) ? '800' : '600';
  }
  renderMyCards(boxNum);
}

function renderMyCards(filterBox) {
  var boxes  = window._mcBoxes;
  var names  = window._mcNames;
  var colors = window._mcColors;
  var text   = window._mcText;
  var html   = '';

  for (var b = 1; b <= 5; b++) {
    if (filterBox > 0 && filterBox !== b) continue;
    var cards = boxes[b];
    if (cards.length === 0 && filterBox === 0) continue;

    // Box header
    html += '<div style="margin-bottom:16px">';
    html += '<div style="background:' + colors[b] + ';color:' + text[b] + ';font-weight:700;font-size:12px;' +
            'padding:8px 12px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">';
    html += '<span>BOX ' + b + ' — ' + names[b].toUpperCase() + '</span>';
    html += '<span style="font-weight:400">' + cards.length + ' card' + (cards.length !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    if (cards.length === 0) {
      html += '<div style="padding:10px 12px;font-size:13px;color:#888;background:#fafafa;' +
              'border-radius:0 0 8px 8px;font-style:italic">No cards in this box yet</div>';
    } else {
      html += '<div style="border:1.5px solid ' + colors[b] + ';border-top:none;border-radius:0 0 8px 8px;overflow:hidden">';

      // Group by wordId
      var wordMap = {};
      cards.forEach(function(card) {
        if (!wordMap[card.wordId]) {
          wordMap[card.wordId] = {wordId: card.wordId, spanish: card.spanish, english: card.english, dirs: []};
        }
        wordMap[card.wordId].dirs.push(card.direction);
      });

      var wordList = Object.values(wordMap);
      for (var wi = 0; wi < wordList.length; wi++) {
        var word      = wordList[wi];
        var bg        = (wi % 2 === 0) ? '#ffffff' : '#fafafa';
        var dirs      = word.dirs.join(' · ');
        var personal  = S.myTranslations[word.wordId] || [];
        var eng       = word.english || '—';
        var personalTag = personal.length > 0
          ? '<span style="font-size:10px;color:#7D3C98;margin-left:6px">+' + personal.length + ' personal</span>'
          : '';

        html += '<div style="display:flex;justify-content:space-between;align-items:center;' +
                'padding:8px 12px;background:' + bg + ';border-bottom:1px solid #f3f4f6;font-size:13px">';
        html += '<div>';
        html += '<span style="font-weight:600;color:#1a1a2e">' + word.spanish + '</span>';
        html += '<span style="color:#888;margin:0 6px">&#8594;</span>';
        html += '<span style="color:#555">' + eng + '</span>';
        html += personalTag;
        html += '</div>';
        html += '<span style="font-size:10px;color:#aaa;white-space:nowrap;margin-left:8px">' + dirs + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  if (!html) {
    html = '<p class="note" style="text-align:center;padding:20px">No cards to show.</p>';
  }
  document.getElementById('myCardsList').innerHTML = html;
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
  const typed     = document.getElementById('preAnswer').value.trim();
  addMyTranslation(w.id, w.spanish, direction, typed);
}

function fuzzyMatchWithPersonal(typed, correct, wordId) {
  if (fuzzyMatch(typed, correct)) return true;
  const personal = S.myTranslations[wordId] || [];
  return personal.some(alt => fuzzyMatch(typed, alt));
}

function addMyTranslation(wordId, spanish, direction, prefill) {
  // prefill = what the student typed that was marked wrong
  const langLabel = direction === 'ES→EN' ? 'English' : 'Spanish';
  let translation;

  if (prefill && prefill.trim()) {
    // Show their wrong answer and ask if they want to save it
    const confirmed = confirm(
      'Save "' + prefill.trim() + '" as an accepted ' + langLabel + ' translation for "' + spanish + '"?'
    );
    if (confirmed) {
      translation = prefill.trim();
    } else {
      // Let them type a different one
      translation = prompt('Type your preferred ' + langLabel + ' translation for "' + spanish + '":');
    }
  } else {
    translation = prompt('Type your preferred ' + langLabel + ' translation for "' + spanish + '":');
  }

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

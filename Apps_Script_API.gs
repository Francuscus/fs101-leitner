// ============================================================
//  Apps_Script_API.gs — FS-101 Leitner Box Backend
//  Pure JSON API — no HTML served from here
//
//  SETUP:
//  1. Open FS-101 Leitner System — Master sheet
//  2. Extensions → Apps Script → replace Code.gs with this
//  3. Deploy → New Deployment → Web App
//     Execute as: Me | Who has access: Anyone
//  4. Paste the deploy URL into js/api.js (API_URL constant)
// ============================================================

var CONFIG = {
  SPREADSHEET_ID: '116b-IW6-Qc4XSSzabK6D_0sGsM1_4TNsbJHyXUSnLhQ',
  SHEET_VOCAB:    'VOCABULARY',
  SHEET_QUIZ:     'QUIZ LOG',
  SHEET_PROFILES: 'STUDENT PROFILES',
  VOCAB_DATA_ROW: 3,   // Row 1=header, Row 2=second header, Row 3=first real word
  PRE_TEST_COUNT: 25,
};

var BOX_INTERVALS = {
  3: [0, 1, 7, 30],
  5: [0, 1, 3, 7, 14, 30],
};

// ── CORS HEADERS ───────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ROUTER ─────────────────────────────────────────────────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  try {
    if (action === 'getVocab')  return corsResponse(getVocab(e.parameter));
    if (action === 'getDeck')   return corsResponse(getDeck(e.parameter.studentId));
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch(err) {
    return corsResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || '';
    if (action === 'savePreTest') return corsResponse(savePreTest(data));
    if (action === 'saveResult')  return corsResponse(saveResult(data));
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch(err) {
    return corsResponse({ error: err.toString() });
  }
}

// ── GET VOCAB ───────────────────────────────────────────────────
function getVocab(params) {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_VOCAB);
  if (!sheet) return { error: 'VOCABULARY sheet not found' };

  var lastRow = sheet.getLastRow();
  var start   = CONFIG.VOCAB_DATA_ROW;
  var numRows = lastRow - start + 1;
  if (numRows < 1) return [];

  var data = sheet.getRange(start, 1, numRows, 14).getValues();
  var limit = parseInt(params && params.limit) || 9999;

  var words = data
    .filter(function(r) {
      return r[0] && String(r[0]).charAt(0) === 'V' && r[1] && r[2];
    })
    .slice(0, limit)
    .map(function(r) {
      return {
        id:      r[0],
        spanish: r[1],
        english: r[2],
        pos:     r[3],
        chapter: r[4],
        week:    r[5],
        cognate: r[6],
        group:   r[12],
      };
    });

  return words;
}

// ── GET DECK ────────────────────────────────────────────────────
function getDeck(studentId) {
  if (!studentId) return [];
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var log = ss.getSheetByName(CONFIG.SHEET_QUIZ);
  if (!log || log.getLastRow() < 2) return [];

  var data = log.getRange(2, 1, log.getLastRow() - 1, 17).getValues();
  var cards = {};

  data.forEach(function(r) {
    if (!r[2] || r[2] !== studentId) return;
    var key = r[5] + '|' + r[8]; // wordId|direction
    var ts  = r[1] ? new Date(r[1]).getTime() : 0;
    if (!cards[key] || ts > (cards[key]._ts || 0)) {
      cards[key] = {
        wordId:    r[5],
        spanish:   r[6],
        direction: r[8],
        box:       parseInt(r[10]) || 1,
        intervention: parseInt(r[12]) || 0,
        streak:    parseInt(r[15]) || 0,
        timestamp: r[1],
        _ts:       ts,
      };
    }
  });

  return Object.values(cards).map(function(c) {
    delete c._ts; return c;
  });
}

// ── SAVE PRE-TEST BATCH ─────────────────────────────────────────
function savePreTest(data) {
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var log = ss.getSheetByName(CONFIG.SHEET_QUIZ);
  if (!log) return { error: 'QUIZ LOG sheet not found' };

  var rows = [];
  var now  = new Date().toLocaleString();

  (data.results || []).forEach(function(w) {
    var boxES = w.resultES === 'PASS' ? 2 : 1;
    var boxEN = w.resultEN === 'PASS' ? 2 : 1;
    // ES→EN card
    rows.push([
      'Q-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      now, data.studentId, data.studentName, data.className,
      w.wordId, w.spanish, w.chapter || '',
      'ES→EN', 0, boxES, 0, 0, w.resultES, 0, 0, w.typedES || '',
    ]);
    // EN→ES card
    rows.push([
      'Q-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      now, data.studentId, data.studentName, data.className,
      w.wordId, w.spanish, w.chapter || '',
      'EN→ES', 0, boxEN, 0, 0, w.resultEN, 0, 0, w.typedEN || '',
    ]);
  });

  if (rows.length > 0) {
    log.getRange(log.getLastRow() + 1, 1, rows.length, 17).setValues(rows);
  }

  saveProfile_(data);
  return { success: true, cardsSeeded: rows.length };
}

// ── SAVE SINGLE RESULT ──────────────────────────────────────────
function saveResult(data) {
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var log = ss.getSheetByName(CONFIG.SHEET_QUIZ);
  if (!log) return { error: 'QUIZ LOG sheet not found' };

  var tier      = parseInt(data.tier) || 5;
  var boxBefore = parseInt(data.boxBefore) || 1;
  var boxAfter  = data.result === 'PASS' ? Math.min(boxBefore + 1, tier) : 1;
  var streak    = data.result === 'PASS' ? (parseInt(data.streakBefore) || 0) + 1 : 0;
  var intBefore = parseInt(data.interventionBefore) || 0;
  var intAfter  = intBefore;

  if (data.result === 'FAIL') {
    var fails = countFails_(log, data.studentId, data.wordId, data.direction);
    if      (fails >= 6) intAfter = 3;
    else if (fails >= 4) intAfter = 2;
    else if (fails >= 2) intAfter = 1;
  } else if (streak >= 3 && intBefore > 0) {
    intAfter = Math.max(0, intBefore - 1);
  }

  var row = [
    'Q-' + Date.now(),
    new Date().toLocaleString(),
    data.studentId, data.studentName, data.className,
    data.wordId, data.spanish, data.chapter || '',
    data.direction, boxBefore, boxAfter, intBefore, intAfter,
    data.result, data.sessionNumber || 1, streak,
    data.typed || '',
  ];
  log.appendRow(row);

  // Color-code the result cell
  var lastRow = log.getLastRow();
  log.getRange(lastRow, 14)
    .setBackground(data.result === 'PASS' ? '#EBF7ED' : '#FDF0F0')
    .setFontColor(data.result === 'PASS' ? '#1E6B2E' : '#7B2C2C');

  // Update class dashboard silently
  updateDashboard_(ss, data.studentId, data.studentName, data.className, log);

  return { success: true, boxAfter: boxAfter, intAfter: intAfter, streak: streak };
}

// ── HELPERS ─────────────────────────────────────────────────────
function countFails_(log, studentId, wordId, direction) {
  if (!log || log.getLastRow() < 2) return 0;
  var data = log.getRange(2, 1, log.getLastRow() - 1, 17).getValues();
  var relevant = data
    .filter(function(r) { return r[2]===studentId && r[5]===wordId && r[8]===direction; })
    .sort(function(a, b) { return new Date(b[1]) - new Date(a[1]); });
  var count = 0;
  for (var i = 0; i < relevant.length; i++) {
    if (relevant[i][13] === 'FAIL') count++; else break;
  }
  return count;
}

function updateDashboard_(ss, studentId, studentName, className, log) {
  var sheet = ss.getSheetByName('CLASS ' + className);
  if (!sheet || sheet.getLastRow() < 2) return;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === studentId) { targetRow = i + 2; break; }
  }
  if (targetRow < 0) return;

  if (!log || log.getLastRow() < 2) return;
  var logData = log.getRange(2, 1, log.getLastRow() - 1, 17).getValues();
  var cards = {};
  logData.filter(function(r){return r[2]===studentId;}).forEach(function(r) {
    var key = r[5] + '|' + r[8];
    if (!cards[key] || new Date(r[1]) > new Date(cards[key].ts))
      cards[key] = { box: parseInt(r[10])||1, ts: r[1] };
  });
  var total    = Object.keys(cards).length;
  var mastered = Object.values(cards).filter(function(c){return c.box>=5;}).length;

  sheet.getRange(targetRow, 2).setValue(studentName);
  sheet.getRange(targetRow, 5).setValue(total);
  sheet.getRange(targetRow, 6).setValue(total - mastered);
  sheet.getRange(targetRow, 7).setValue(mastered);
  sheet.getRange(targetRow, 9).setValue(new Date().toLocaleString());
}

function saveProfile_(data) {
  var ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var prof = ss.getSheetByName(CONFIG.SHEET_PROFILES);
  if (!prof) return;
  var lastRow = prof.getLastRow();
  var found   = -1;
  if (lastRow > 1) {
    var ids = prof.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === data.studentId) { found = i + 2; break; }
    }
  }
  var now = new Date().toLocaleString();
  var row = [
    data.studentId, data.studentName, data.className, '',
    data.tier || 5, now, data.preTestScore || '',
    data.totalWords || 50, data.totalWords || 50, 0,
    '','','','','','','','', 0, 0, 0, now, 1, 0, '',
  ];
  if (found > 0) prof.getRange(found, 1, 1, row.length).setValues([row]);
  else prof.appendRow(row);
}

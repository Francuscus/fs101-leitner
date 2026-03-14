// ============================================================
//  FS-101 LEITNER API — Code.gs (Apps Script)
//  Pure JSON API — no HTML served here
//
//  DEPLOY: Web App, Execute as Me, Anyone can access
//  CORS:   All origins allowed via ContentService
//
//  ENDPOINTS (GET):
//    ?action=getVocab              → full vocabulary array
//    ?action=getDeck&id=STU_ID     → student's card states
//
//  ENDPOINTS (POST, JSON body):
//    action=saveResult             → one quiz result
//    action=saveBatch              → pre-test batch
// ============================================================

var SS_ID = '116b-IW6-Qc4XSSzabK6D_0sGsM1_4TNsbJHyXUSnLhQ';

var SHEETS = {
  VOCAB:    'VOCABULARY',
  QUIZ:     'QUIZ LOG',
  CLASS_A:  'CLASS A',
  CLASS_B:  'CLASS B',
  CLASS_C:  'CLASS C',
  PROFILES: 'STUDENT PROFILES',
};

// ── ROUTER ────────────────────────────────────────────────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : '';
  var result;

  try {
    if (action === 'getVocab') {
      result = getVocab();
    } else if (action === 'getDeck') {
      result = getDeck(e.parameter.id || '');
    } else {
      result = { error: 'Unknown action: ' + action };
    }
  } catch(err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result;
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || '';
    if      (action === 'saveResult') result = saveResult(data);
    else if (action === 'saveBatch')  result = saveBatch(data);
    else result = { error: 'Unknown action: ' + action };
  } catch(err) {
    result = { error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET VOCABULARY ────────────────────────────────────────────
function getVocab() {
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(SHEETS.VOCAB);
  if (!sheet || sheet.getLastRow() < 3) return [];

  var numRows = sheet.getLastRow() - 2;
  var data    = sheet.getRange(3, 1, numRows, 14).getValues();

  return data
    .filter(function(r) {
      return r[0] && String(r[0]).charAt(0) === 'V' && r[1] && r[2];
    })
    .map(function(r) {
      return {
        id:       String(r[0]),
        spanish:  String(r[1]),
        english:  String(r[2]),
        pos:      String(r[3]),
        chapter:  String(r[4]),
        week:     String(r[5]),
        cognate:  String(r[6]),
        freq:     String(r[8]),
        intDef:   String(r[9]),
        group:    String(r[12]),
      };
    });
}

// ── GET STUDENT DECK ──────────────────────────────────────────
function getDeck(studentId) {
  if (!studentId) return [];
  var ss  = SpreadsheetApp.openById(SS_ID);
  var log = ss.getSheetByName(SHEETS.QUIZ);
  if (!log || log.getLastRow() < 2) return [];

  var numRows = log.getLastRow() - 1;
  var data    = log.getRange(2, 1, numRows, 17).getValues();

  // Latest state per card (wordId + direction)
  var cards = {};
  data.forEach(function(r) {
    if (!r[2] || String(r[2]) !== studentId) return;
    var key = String(r[5]) + '|' + String(r[8]);
    var ts  = new Date(r[1]).getTime();
    if (!cards[key] || ts > cards[key].ts) {
      cards[key] = {
        wordId:       String(r[5]),
        spanish:      String(r[6]),
        direction:    String(r[8]),
        box:          parseInt(r[10]) || 1,
        intervention: parseInt(r[12]) || 0,
        streak:       parseInt(r[15]) || 0,
        ts:           ts,
        timestamp:    String(r[1]),
      };
    }
  });

  return Object.values(cards);
}

// ── SAVE SINGLE RESULT ────────────────────────────────────────
function saveResult(data) {
  var ss  = SpreadsheetApp.openById(SS_ID);
  var log = ss.getSheetByName(SHEETS.QUIZ);
  if (!log) return { error: 'QUIZ LOG not found' };

  var tier      = parseInt(data.tier) || 5;
  var boxBefore = parseInt(data.boxBefore) || 1;
  var boxAfter  = data.result === 'PASS' ? Math.min(boxBefore + 1, tier) : 1;
  var streak    = data.result === 'PASS' ? (parseInt(data.streakBefore) || 0) + 1 : 0;
  var intBefore = parseInt(data.interventionBefore) || 0;
  var intAfter  = intBefore;

  if (data.result === 'FAIL') {
    var fails = countFails_(data.studentId, data.wordId, data.direction, log);
    if      (fails >= 6) intAfter = 3;
    else if (fails >= 4) intAfter = 2;
    else if (fails >= 2) intAfter = 1;
  } else if (streak >= 3 && intBefore > 0) {
    intAfter = Math.max(0, intBefore - 1);
  }

  var row = [
    'Q-' + Date.now(),
    new Date().toLocaleString(),
    data.studentId   || '',
    data.studentName || '',
    data.className   || '',
    data.wordId      || '',
    data.spanish     || '',
    data.chapter     || '',
    data.direction   || '',
    boxBefore,
    boxAfter,
    intBefore,
    intAfter,
    data.result      || '',
    data.sessionNum  || 1,
    streak,
    data.typed       || '',
  ];

  log.appendRow(row);
  var lastRow = log.getLastRow();
  log.getRange(lastRow, 14)
     .setBackground(data.result === 'PASS' ? '#EBF7ED' : '#FDF0F0')
     .setFontColor(data.result === 'PASS' ? '#1E6B2E' : '#7B2C2C');

  updateDashboard_(data.studentId, data.studentName, data.className, ss);

  return { success: true, boxAfter: boxAfter, intAfter: intAfter, streak: streak };
}

// ── SAVE PRE-TEST BATCH ───────────────────────────────────────
function saveBatch(data) {
  var ss  = SpreadsheetApp.openById(SS_ID);
  var log = ss.getSheetByName(SHEETS.QUIZ);
  if (!log) return { error: 'QUIZ LOG not found' };

  var rows = [];
  var now  = new Date().toLocaleString();

  (data.results || []).forEach(function(w) {
    var boxES = w.resultES === 'PASS' ? 2 : 1;
    var boxEN = w.resultEN === 'PASS' ? 2 : 1;
    rows.push(['Q-' + Date.now() + '-' + Math.random().toString(36).slice(2),
               now, data.studentId, data.studentName, data.className,
               w.wordId, w.spanish, w.chapter || '', 'ES→EN',
               0, boxES, 0, 0, w.resultES, 0, 0, w.typedES || '']);
    rows.push(['Q-' + Date.now() + '-' + Math.random().toString(36).slice(2),
               now, data.studentId, data.studentName, data.className,
               w.wordId, w.spanish, w.chapter || '', 'EN→ES',
               0, boxEN, 0, 0, w.resultEN, 0, 0, w.typedEN || '']);
  });

  if (rows.length > 0) {
    log.getRange(log.getLastRow() + 1, 1, rows.length, 17).setValues(rows);
  }

  saveProfile_(data, ss);
  return { success: true, cardsSeeded: rows.length };
}

// ── HELPERS ───────────────────────────────────────────────────
function countFails_(studentId, wordId, direction, log) {
  if (log.getLastRow() < 2) return 0;
  var data = log.getRange(2, 1, log.getLastRow() - 1, 17).getValues();
  var relevant = data
    .filter(function(r) {
      return String(r[2]) === studentId &&
             String(r[5]) === wordId &&
             String(r[8]) === direction;
    })
    .sort(function(a, b) { return new Date(b[1]) - new Date(a[1]); });
  var count = 0;
  for (var i = 0; i < relevant.length; i++) {
    if (relevant[i][13] === 'FAIL') count++; else break;
  }
  return count;
}

function updateDashboard_(studentId, studentName, className, ss) {
  var sheet = ss.getSheetByName('CLASS ' + className);
  if (!sheet || sheet.getLastRow() < 2) return;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var targetRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === studentId) { targetRow = i + 2; break; }
  }
  if (targetRow < 0) return;

  var log = ss.getSheetByName(SHEETS.QUIZ);
  if (!log || log.getLastRow() < 2) return;
  var logData = log.getRange(2, 1, log.getLastRow() - 1, 17).getValues();
  var cards   = {};
  logData.filter(function(r) { return String(r[2]) === studentId; })
         .forEach(function(r) {
           var key = r[5] + '|' + r[8];
           if (!cards[key] || new Date(r[1]) > new Date(cards[key].ts))
             cards[key] = { box: parseInt(r[10]) || 1, ts: r[1] };
         });

  var total    = Object.keys(cards).length;
  var mastered = Object.values(cards).filter(function(c) { return c.box >= 5; }).length;

  sheet.getRange(targetRow, 2).setValue(studentName);
  sheet.getRange(targetRow, 5).setValue(total);
  sheet.getRange(targetRow, 6).setValue(total - mastered);
  sheet.getRange(targetRow, 7).setValue(mastered);
  sheet.getRange(targetRow, 9).setValue(new Date().toLocaleString());
}

function saveProfile_(data, ss) {
  var prof = ss.getSheetByName(SHEETS.PROFILES);
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
  var row = [data.studentId, data.studentName, data.className, '',
             data.tier || 5, now, data.preTestScore || '',
             (data.results || []).length * 2, (data.results || []).length * 2, 0,
             '', '', '', '', '', '', '', '', 0, 0, 0, now, 1, 0, ''];
  if (found > 0) prof.getRange(found, 1, 1, row.length).setValues([row]);
  else           prof.appendRow(row);
}

// ============================================================
//  api.js — All communication with Apps Script backend
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwIbPMMcjSJKkyFc8bkfagiOStfiGmXedjpWxfhKj7oyIlXf5x_h8Tcvle8ypW4okTgPA/exec';

const Api = (() => {

  async function get(params) {
    const url = new URL(API_URL);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Network error: ' + res.status);
    return res.json();
  }

  async function post(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Network error: ' + res.status);
    return res.json();
  }

  // Get first 25 numbered vocab words for pre-test
  async function getPreTestWords() {
    return get({ action: 'getVocab', limit: 25 });
  }

  // Get student's full deck state
  async function getDeck(studentId) {
    return get({ action: 'getDeck', studentId });
  }

  // Save entire pre-test batch
  async function savePreTest(data) {
    return post({ action: 'savePreTest', ...data });
  }

  // Save a single quiz result
  async function saveResult(data) {
    return post({ action: 'saveResult', ...data });
  }

  return { getPreTestWords, getDeck, savePreTest, saveResult };
})();

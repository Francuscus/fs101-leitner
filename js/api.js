// ============================================================
//  api.js — All communication with Apps Script backend
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwIbPMMcjSJKkyFc8bkfagiOStfiGmXedjpWxfhKj7oyIlXf5x_h8Tcvle8ypW4okTgPA/exec';

const Api = (() => {

  // GET request — follows redirects, returns parsed JSON
  async function get(params) {
    const url = new URL(API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    // Apps Script redirects — must follow
    const res = await fetch(url.toString(), { redirect: 'follow' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      console.error('API parse error:', text.slice(0, 200));
      throw new Error('Bad response from server');
    }
  }

  // POST request
  async function post(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // avoid preflight CORS
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      console.error('API parse error:', text.slice(0, 200));
      throw new Error('Bad response from server');
    }
  }

  // Ensure result is always an array
  function asArray(result) {
    if (Array.isArray(result)) return result;
    if (result && result.error) throw new Error('API error: ' + result.error);
    if (result && Array.isArray(result.data)) return result.data;
    console.warn('Unexpected API response:', result);
    return [];
  }

  async function getPreTestWords() {
    const result = await get({ action: 'getVocab', limit: 25 });
    return asArray(result);
  }

  async function getDeck(studentId) {
    const result = await get({ action: 'getDeck', studentId });
    return asArray(result);
  }

  async function savePreTest(data) {
    return post({ action: 'savePreTest', ...data });
  }

  async function saveResult(data) {
    return post({ action: 'saveResult', ...data });
  }

  return { getPreTestWords, getDeck, savePreTest, saveResult };
})();

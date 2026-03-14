// ============================================================
//  api.js — All communication with Apps Script backend
//  Uses JSONP via script tag injection (CORS-safe for Apps Script)
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyYQpBpmb-Zgl_uPQYIaJEWrv9759I-PKIcNNccMZLz97OZRM0iNPi1Kmcwi0FYV4E0fg/exec';

const Api = (() => {

  function jsonpGet(params) {
    return new Promise((resolve, reject) => {
      const cbName = 'leitner_cb_' + Date.now();
      const url    = new URL(API_URL);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      url.searchParams.set('callback', cbName);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out after 15s'));
      }, 15000);

      window[cbName] = (data) => {
        cleanup();
        if (data && data.error) reject(new Error('API error: ' + data.error));
        else resolve(data);
      };

      function cleanup() {
        clearTimeout(timeout);
        delete window[cbName];
        const el = document.getElementById(cbName);
        if (el) el.remove();
      }

      const script  = document.createElement('script');
      script.id     = cbName;
      script.type   = 'text/javascript';
      // Use the googleusercontent redirect URL to avoid CSP blocking
      script.src    = url.toString();
      script.onerror = (e) => {
        cleanup();
        reject(new Error('Script load error — check browser console'));
      };
      document.head.appendChild(script);
    });
  }

  async function getPreTestWords() {
    return jsonpGet({ action: 'getVocab', limit: 25 });
  }

  async function getDeck(studentId) {
    return jsonpGet({ action: 'getDeck', studentId });
  }

  async function savePreTest(data) {
    return jsonpGet({ action: 'savePreTest', payload: JSON.stringify(data) });
  }

  async function saveResult(data) {
    return jsonpGet({ action: 'saveResult', payload: JSON.stringify(data) });
  }

  return { getPreTestWords, getDeck, savePreTest, saveResult };
})();

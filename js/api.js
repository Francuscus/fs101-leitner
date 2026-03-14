// ============================================================
//  api.js — All communication with Apps Script backend
//  Uses JSONP for GET (bypasses CORS), GET params for POST data
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyYQpBpmb-Zgl_uPQYIaJEWrv9759I-PKIcNNccMZLz97OZRM0iNPi1Kmcwi0FYV4E0fg/exec';

const Api = (() => {

  // JSONP GET — works cross-origin without CORS headers
  function jsonpGet(params) {
    return new Promise((resolve, reject) => {
      const cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const url    = new URL(API_URL);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      url.searchParams.set('callback', cbName);

      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out'));
      }, 15000);

      window[cbName] = (data) => {
        cleanup();
        if (data && data.error) reject(new Error('API error: ' + data.error));
        else resolve(data);
      };

      function cleanup() {
        clearTimeout(timeout);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      script.onerror = () => { cleanup(); reject(new Error('Script load error')); };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  // GET-based save — encode data as URL params, use no-cors fetch
  // Apps Script logs the data even without a readable response
  function getPost(action, data) {
    return new Promise((resolve) => {
      const url = new URL(API_URL);
      url.searchParams.set('action', action);
      // Encode the payload as a single JSON param
      url.searchParams.set('payload', JSON.stringify(data));
      const script = document.createElement('script');
      const cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      url.searchParams.set('callback', cbName);
      window[cbName] = (result) => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(result || { success: true });
      };
      script.onerror = () => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve({ success: true }); // treat save errors as non-fatal
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  // Get first 25 numbered vocab words for pre-test
  async function getPreTestWords() {
    return jsonpGet({ action: 'getVocab', limit: 25 });
  }

  // Get student's full deck state
  async function getDeck(studentId) {
    return jsonpGet({ action: 'getDeck', studentId });
  }

  // Save entire pre-test batch
  async function savePreTest(data) {
    return getPost('savePreTest', data);
  }

  // Save a single quiz result
  async function saveResult(data) {
    return getPost('saveResult', data);
  }

  return { getPreTestWords, getDeck, savePreTest, saveResult };
})();

// ============================================================
//  speech.js — Web Speech API wrapper
//  Recognition (student speaks) + Synthesis (app speaks prompt)
// ============================================================

const Speech = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  function supported() { return !!SpeechRecognition; }
  function synthSupported() { return 'speechSynthesis' in window; }

  // Speak a word aloud using TTS
  function speak(text, lang = 'es-AR') {
    if (!synthSupported()) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang; utt.rate = 0.9; utt.pitch = 1;
    window.speechSynthesis.speak(utt);
  }

  // Listen for one spoken answer
  function listen({ lang = 'en-US', onResult, onEnd, onError }) {
    if (!supported()) {
      if (onError) onError('Speech recognition not supported. Please use Chrome.');
      return;
    }
    if (listening) stop();
    recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (onResult) onResult(final || interim, !!final);
    };
    recognition.onend = () => { listening = false; if (onEnd) onEnd(); };
    recognition.onerror = (event) => { listening = false; if (onError) onError(event.error); };
    recognition.start();
    listening = true;
  }

  function stop() {
    if (recognition && listening) { recognition.stop(); listening = false; }
  }

  return { supported, synthSupported, speak, listen, stop,
           isListening: () => listening };
})();

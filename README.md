# FS-101 Leitner Box
**Monmouth University · Prof. Cipriani · Spanish 101**

Spaced-repetition vocabulary trainer with speech recognition.

## File Structure
```
fs101-leitner/
├── index.html              ← Main app (open this in browser)
├── css/style.css           ← All styles
├── js/
│   ├── app.js              ← State management and screen logic
│   ├── quiz.js             ← Leitner box movement logic
│   ├── speech.js           ← Web Speech API (mic + TTS)
│   ├── fuzzy.js            ← Answer matching (accents + spelling)
│   └── api.js              ← Fetch calls to Apps Script
├── Apps_Script_API.gs      ← Paste this into Google Apps Script
└── README.md               ← This file
```

## Setup Instructions

### Step 1 — Deploy the Apps Script API
1. Open your **FS-101 Leitner System — Master** Google Sheet
2. Extensions → Apps Script
3. Replace all of Code.gs with the contents of `Apps_Script_API.gs`
4. Save
5. Deploy → New Deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deploy URL

### Step 2 — Add the URL to api.js
Open `js/api.js` and replace this line:
```javascript
const API_URL = 'YOUR_APPS_SCRIPT_DEPLOY_URL_HERE';
```
with your actual deploy URL:
```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

> Tip: if you paste a `/dev` testing URL, `js/api.js` now auto-normalizes it to `/exec`. You can also override the endpoint without code changes by setting `localStorage.setItem('leitnerApiUrl', 'YOUR_URL')` in the browser console.

### Step 3 — Push to GitHub Pages
1. Create a new GitHub repo (e.g. `fs101-leitner`)
2. Push all files to the `main` branch
3. Settings → Pages → Source: `main` branch → `/` (root)
4. Your app will be live at: `https://YOUR_USERNAME.github.io/fs101-leitner/`

### Step 4 — Share with students
Give students the GitHub Pages URL.
- Works on any device in Chrome
- Name + class saved automatically after first visit
- Returning students go straight to their dashboard

## How Speech Works
- **Speak button**: activates microphone, listens for answer, auto-submits on final result
- **Type button / Enter key**: traditional typed input
- Students can switch between speech and typing on any card
- Spanish → English cards: microphone listens for **English**
- English → Spanish cards: microphone listens for **Spanish (es-AR)**
- TTS reads the prompt aloud automatically when a review card loads

## Speech Recognition Note
Web Speech API requires **Chrome** (desktop or Android).
Safari/Firefox users will see a message asking them to use Chrome or type instead.

## Grading Scale
| Cards Mastered | Grade |
|---|---|
| 147+ | D |
| 294+ | C |
| 441+ | B |
| 598+ | A |
| 737 | A+ |

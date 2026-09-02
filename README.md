# StreamHub — YouTube-inspired Video App UI

Material Design 3 पर आधारित एक video-streaming app UI — pure HTML, CSS और
vanilla JavaScript में बना है। किसी भी बिल्ड टूल की ज़रूरत नहीं (Google Fonts
optional है)। पूरा कंटेंट सीधे **Internet Archive (archive.org)** की public API
से लाइव आता है।

## चलाने का तरीका

`index.html` को किसी भी ब्राउज़र में खोलें — archive.org API को `fetch()`
करने के लिए फ़ाइल को सीधे डबल-क्लिक (file://) से खोलने की बजाय एक लोकल
सर्वर से चलाएं, वरना ब्राउज़र CORS/security की वजह से रिक्वेस्ट ब्लॉक कर
सकता है:

```bash
# repo root में:
python3 -m http.server 8000
# फिर ब्राउज़र में खोलें: http://localhost:8000
```

या npm से:

```bash
npm install
npm run serve
```

## फ़ोल्डर स्ट्रक्चर

```
.
├── index.html              → पूरा ऐप (Home feed + Video Player + Library, views toggle होते हैं)
├── css/style.css           → सारे डिज़ाइन टोकन, कलर, टाइपोग्राफी, लेआउट
├── js/archive.js           → archive.org API wrapper (search, metadata, thumbnails, embed URL)
├── js/app.js               → रेंडरिंग लॉजिक, व्यू स्विचिंग, असली प्लेयर एम्बेड
├── favicon.svg             → साइट आइकन
├── scripts/
│   ├── verify.mjs          → चेक करता है कि index.html में refer की गई सारी local assets मौजूद हैं
│   └── smoke-test.mjs      → jsdom में पूरा ऐप फ़्लो टेस्ट (mock API के साथ)
├── eslint.config.js        → JavaScript linting (ESLint, flat config)
├── stylelint.config.cjs    → CSS linting
├── .htmlvalidate.json      → HTML validation
├── .github/workflows/ci.yml→ CI: lint + tests, और main पर GitHub Pages deploy
└── package.json            → dev scripts (lint / test / serve)
```

## फीचर्स

- **Live content** — पूरा फीड, सर्च और प्लेबैक सीधे **archive.org की public API**
  से आता है (कोई API key नहीं चाहिए)
- **Home Feed** — responsive card grid (mobile पर 1 कॉलम, desktop पर 4),
  असली thumbnails के साथ
- **Filter chips** — archive.org के collections से मैप्ड: मूवीज़, क्लासिक टीवी,
  म्यूज़िक, एनिमेशन, न्यूज़रील्स, NASA, आर्काइव्ड फ़िल्में
- **Search bar** — archive.org पर title/subject/creator से खोजें; query
  sanitize होती है, `Enter` से खोज और `Esc` से बंद
- **Video Player screen** — असली archive.org embed player (video/audio दोनों),
  ambient glow effect, असली title/description/creator, **जानकारी टैब**
  (creator, mediatype, subjects, files…), related items वाला up-next
- **Player actions** — Subscribe (persist होता है), Like/Dislike, Share
  (archive.org का लिंक clipboard पर), Download (archive.org की files पेज पर)
- **Mini player** — होम पर वापस जाने पर चल रहा वीडियो bottom-right में
  मिनिमाइज़ हो जाता है (iframe DOM में move होता है, reload नहीं होता)
- **Library (watch history)** — देखे हुए वीडियो इस डिवाइस पर सेव रहते हैं,
  एक क्लिक में फिर से खुलते हैं; "इतिहास साफ़ करें" से मिट जाते हैं
- **Browser back/forward** — History API integration: ब्राउज़र का बैक बटन
  ऐप के व्यूज़ के साथ सही से काम करता है
- **Bottom navigation** — Home, Shorts, Create, Subscriptions, Library
  (Shorts/Create/Subscriptions अभी placeholder हैं)
- **Dark theme** — YouTube जैसा डार्क बेस + red accent (सिर्फ CTA के लिए)
- पूरी तरह **responsive** — mobile से लेकर desktop तक; cards keyboard से
  भी खुलते हैं (Tab + Enter), screen-reader लेबल्स शामिल

## डेवलपर workflow

```bash
npm install        # dev dependencies (eslint, stylelint, html-validate, jsdom)
npm run lint       # JS + HTML + CSS सारे checks
npm run lint:fix   # auto-fix जहाँ possible हो
npm run check      # index.html में refer की गई assets मौजूद हैं या नहीं
npm test           # jsdom smoke test — पूरा UI flow (mock API के साथ)
npm run serve      → http://localhost:8000
```

**Tip:** commit से पहले `npm run lint && npm test` चला लें — यही चीज़ें CI
में भी चलती हैं।

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` हर push/PR पर ये jobs चलाती है:

1. **Lint & verify** — ESLint, html-validate, Stylelint, asset check,
   jsdom smoke test, और एक छोटा serve-and-fetch smoke test
2. **Deploy to GitHub Pages** — `main` पर merge होते ही साइट Pages पर
   publish हो जाती है (इसके लिए Repo Settings → Pages → Source:
   **GitHub Actions** चुना होना चाहिए)

इसके लिए repo की Pages setting में Source को "GitHub Actions" चुना होना
चाहिए। Deploy होने के बाद साइट यहाँ मिलेगी:
`https://<username>.github.io/Internet-archive/`

## कस्टमाइज़ करना

- **Collections बदलना:** `index.html` में `#chips` के अंदर हर `<button>` का
  `data-query` attribute archive.org का search query है। पूरी query syntax:
  https://archive.org/advancedsearch.php
- **Default feed:** `js/app.js` में `DEFAULT_QUERY` सबसे पहले active chip से
  उठता है।
- **History साइज़:** `js/app.js` में `HISTORY_LIMIT` बदलें।

## ध्यान दें

यह एक **डिज़ाइन/लर्निंग प्रोजेक्ट** है — YouTube का ब्रांड नाम या लोगो
इस्तेमाल नहीं किया गया (placeholder branding "StreamHub" है), लेकिन असली
वीडियो कंटेंट सीधे **Internet Archive (archive.org)** से लाइव आता है —
यह एक non-profit digital library है और इसका ज़्यादातर कंटेंट पब्लिक डोमेन या
ओपन-लाइसेंस्ड है। इसे प्रोडक्शन में इस्तेमाल करने से पहले archive.org की
Terms of Use ज़रूर देख लें: https://archive.org/about/terms.php

## License

[MIT](LICENSE)

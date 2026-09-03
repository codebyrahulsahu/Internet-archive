# StreamHub — YouTube-inspired Video App UI (powered by archive.org)

Material Design 3 पर आधारित एक video-streaming app UI — pure HTML, CSS और
vanilla JavaScript में बना है, कोई बिल्ड टूल नहीं चाहिए। सारा कंटेंट
**Internet Archive (archive.org)** की public API से लाइव आता है।

## ज़रूरी: लोकल/असली सर्वर से चलाएं

फाइल को सीधे डबल-क्लिक (`file://`) से खोलने पर archive.org की API कॉल्स
ब्राउज़र में ब्लॉक हो सकती हैं। हमेशा एक सर्वर से चलाएं:

```bash
npm run serve            # या: python3 -m http.server 8000
# फिर खोलें: http://localhost:8000
```

कोड चेक करने के लिए (CI यही चलाता है):

```bash
npm ci
npm run lint   # eslint + html-validate + stylelint
npm run check  # index.html में refer किए गए सारे assets मौजूद हैं या नहीं
npm test       # jsdom smoke test + regression suite (पूरा UI फ्लो)
```

डिप्लॉय करने के लिए किसी भी static host (Netlify, Vercel, GitHub Pages,
Cloudflare Pages) पर पूरा फ़ोल्डर अपलोड कर दें — कोई बैकएंड नहीं चाहिए।

## इस अपडेट में क्या ठीक/जोड़ा गया

- **Custom player (कोई तीसरी-पार्टी embed नहीं)** — अब archive.org के default
  embed player की जगह अपना खुद का `<video>`/`<audio>` player है, custom
  play/pause, progress bar, mute और fullscreen कंट्रोल्स के साथ।
- **PDF अब video/audio फ़ीड में नहीं आतीं** — हर सर्च क्वेरी में सख्ती से
  `mediatype:(movies)`/`mediatype:(audio)`/`mediatype:(texts)` फ़िल्टर जोड़ा गया
  है, plus एक client-side डबल-चेक।
  (देखें `js/archive.js` में `search()` और `kindOf()`)
- **PDF/Books के लिए अलग सेक्शन** — filter chips में नया **"PDF / Books"** चिप
  है। खोलने पर एक dedicated PDF reader स्क्रीन दिखती है (browser के native PDF
  व्यूअर में, portrait-friendly बड़े व्यूपोर्ट के साथ) — video player वाला
  play/pause/progress UI इसमें नहीं दिखता, बस Download/Share/Save और
  "archive.org पर पूरा पेज खोलें" लिंक होता है। अगर किसी आइटम में सीधा PDF
  फ़ाइल न मिले, एक friendly fallback मैसेज दिखता है (टूटता नहीं)।
- **ऑडियो अब अलग दिखता है** — ऑडियो आइटम खुलने पर वीडियो जैसा काला बॉक्स नहीं,
  बल्कि एक dedicated audio player UI (art + badge) दिखता है, हालांकि कंट्रोल्स
  वही custom control bar इस्तेमाल करते हैं।
- **Download सेक्शन** — प्लेयर स्क्रीन पर "Download" दबाने पर उस आइटम की सभी
  उपलब्ध फ़ाइलें (format + size के साथ) दिखती हैं, हर एक पर सीधा डाउनलोड लिंक।
- **Save / Watch Later** — "Save" बटन दबाकर कोई भी वीडियो/ऑडियो सेव करें;
  यह ब्राउज़र के `localStorage` में रहता है (कोई लॉगिन नहीं चाहिए) और
  bottom nav के **Library** टैब में दिखता है।
- **कोई डिफ़ॉल्ट/थर्ड-पार्टी प्लेयर नहीं, कोई iframe नहीं** — पूरी तरह native
  HTML5 media elements, ताकि प्लेबैक पर पूरा कंट्रोल रहे।
- **Shorts और Subscribe हटाए गए** — bottom nav से Shorts हटाया गया, player
  स्क्रीन से Subscribe बटन हटाया गया (कोई channel-subscription फीचर नहीं है)।
- **भाषा टॉगल (Hindi/English)** — टॉप बार में "EN / हिं" बटन से पूरी ऐप की
  UI भाषा बदलें; चुनाव `localStorage` में सेव रहता है। नई स्ट्रिंग्स
  `js/i18n.js` में जोड़ें।
- **आवाज़ से खोज (Mic)** — सर्च बार में 🎤 आइकन दबाकर बोलकर खोजें (Web Speech
  API इस्तेमाल होती है — Chrome/Edge में सबसे बेहतर काम करता है; भाषा चुनी
  हुई UI भाषा के हिसाब से hi-IN/en-US सेट होती है)।

## बग-फिक्स पास (इस PR में)

हर फिक्स के लिए `scripts/smoke-test.mjs` में एक regression टेस्ट है
(`npm test`) — टेस्ट पहले पुराने कोड पर fail करते हैं, तब ही पास होते हैं।

**लेआउट / दिखने वाले बग**

- `hidden` attribute काम ही नहीं कर रहा था — stylesheet में कहीं
  `[hidden]{display:none}` नहीं था, इसलिए `.mini-player`, `.chips`,
  `.search-bar`, `.icon-btn`, `.player-loading`, `.custom-controls`,
  `.audio-stage` जैसे author rules (`display:flex`) UA rule को हरा देते थे।
  नतीजा: back बटन, सर्च बार, mini player, "Loading…" overlay और play/pause +
  volume के दोनों आइकन हमेशा दिखते थे, और ≥860px पर `.player-view{display:grid}`
  की वजह से player स्क्रीन होम के साथ हमेशा दिखती थी। अब
  `[hidden]{display:none !important}` जोड़ा गया है।
- **Desktop पर Library खुल ही नहीं सकती थी** — ≥860px पर `.bottom-nav` छिपा
  दिया जाता है, और वहां उसके बदले कुछ नहीं था। अब top bar में Home/Library
  शॉर्टकट आ गए हैं (`.topbar-only`)।
- **Desktop का दो-कॉलम player लेआउट टूटा था** — `.uplist{grid-column:2}` था,
  पर `#upNext` `.scroll-area` के *अंदर* था, इसलिए वो grid child ही नहीं था
  (दाईं ओर 360px की खाली पट्टी बनती थी)। `#upNext` और `#commentsDisabled` अब
  `.player-view` के direct children हैं।
- `favicon.svg` रेपो में था और CI उसे चेक भी करता था, पर पेज उसे refer ही नहीं
  करता था — अब `<link rel="icon">` जोड़ा गया।

**नेविगेशन**

- Back बटन हमेशा Home पर ले जाता था, भले ही आइटम Library से खोला गया हो — और
  bottom nav का highlight गलत टैब पर रह जाता था। अब player किस list से खुला था
  वो याद रखा जाता है और दोनों nav (bottom + top) sync रहते हैं।
- Player स्क्रीन से सर्च करने पर chips दिखने लगते थे और नतीजे player के *पीछे*
  लोड होते थे। अब सर्च हमेशा होम फ़ीड पर ले जाती है।

**सर्च**

- archive.org का सर्च Lucene syntax है — यूज़र के टाइप किए `( ) : " AND OR`
  जैसे कैरेक्टर सीधे क्वेरी में चले जाते थे, जिससे क्वेरी टूटती/बदल जाती थी।
  अब इनपुट sanitize होता है; सिर्फ़ punctuation टाइप करने पर रिक्वेस्ट ही नहीं
  जाती और एक साफ़ मैसेज दिखता है।
- सर्च हमेशा `mediatype:(movies)` में होती थी — "PDF / Books" या "Music" चिप
  चुनने के बाद सर्च करने पर भी। अब सर्च चुने हुए चिप का mediatype इस्तेमाल
  करती है।
- तेज़ी से चिप बदलने पर पुरानी (धीमी) रिस्पॉन्स नई फ़ीड को मिटा देती थी —
  अब हर रिक्वेस्ट का token है और पुरानी रिस्पॉन्स discard होती है।

**भाषा (i18n)**

- डाउनलोड काउंट्स hardcoded Hindi में थे ("1.5 हज़ार") — English UI में भी।
  अब `Intl.NumberFormat(notation:"compact")` एक्टिव भाषा के हिसाब से फॉर्मैट
  करता है ("1.5K" / "1.5 हज़ार")।
- भाषा बदलने पर फ़ीड/लाइब्रेरी के कार्ड पुरानी भाषा में ही रहते थे, और
  `data-i18n-inline` attribute को कोई पढ़ता ही नहीं था। अब दोनों ठीक हैं —
  counts मॉडल में raw number की तरह रखे जाते हैं और रेंडर के समय फॉर्मैट होते
  हैं (दोबारा फ़ेच किए बिना)।
- सेव की हुई भाषा के साथ पेज खोलने पर `<html lang>` "hi" ही रहता था — अब
  `I18N.apply()` उसे sync करता है।

**प्लेयर**

- एक घंटे से लंबी वीडियो "62:05" जैसी दिखती थीं — अब `1:02:05`।
- Live/infinite-duration स्ट्रीम पर प्रोग्रेस बार `NaN%` सेट हो जाता था।
- पिछले आइटम का mute स्टेट अगले आइटम के आइकन्स पर बना रहता था।
- नया आइटम खोलने पर टैब्स "Comments" पर अटके रहते थे (up-next छिपा हुआ)।
- ऑडियो/PDF पर भी Fullscreen बटन दिखता था, जो कुछ नहीं करता।
- PDF लोडिंग का 4 सेकंड का टाइमर अगले आइटम पर भी चल जाता था — अब साफ़ होता है।

**रोबस्टनेस / सुरक्षा**

- `localStorage` ब्लॉक हो (private mode/quota) तो Save बटन uncaught
  `QuotaExceededError` से टूट जाता था — अब बटन पर "सेव नहीं हो सका" दिखता है।
  खराब JSON भी ऐप नहीं तोड़ता।
- archive.org का metadata यूज़र-सप्लाइड है: download लिस्ट में `format` स्ट्रिंग
  बिना escape के HTML में जाती थी (markup inject हो सकता था) — अब escape होता
  है; `data-id`/initials/`style` gradients भी harden किए गए हैं।
- description पढ़ने के लिए `innerHTML` की जगह `DOMParser` — detached div में
  भी `<img onerror=…>` चल सकता है।
- Mic: `recognizer.start()` permission मिलने पर throw करता है (अनहैंडल्ड था),
  और सर्च बार बंद करने पर mic चालू रहता था।

## फ़ोल्डर स्ट्रक्चर

```
.
├── index.html        → पूरा ऐप (Home / Library / Player, सब एक फाइल में toggle होते हैं)
├── css/style.css      → डिज़ाइन टोकन, कलर, टाइपोग्राफी, लेआउट
├── js/i18n.js          → भाषा डिक्शनरी (Hindi/English) + toggle लॉजिक
├── js/archive.js        → archive.org API wrapper (search, metadata, फ़ाइल चुनना, downloads)
├── js/app.js              → रेंडरिंग, प्लेयर, सेव/लाइब्रेरी, सर्च, माइक — पूरा ऐप लॉजिक
└── scripts/               → verify.mjs (asset check) + smoke-test.mjs (jsdom टेस्ट)
```

## कस्टमाइज़ करना

- **Collections बदलना:** `index.html` में हर filter chip का `data-query`
  archive.org search query है, `data-kind` बताता है वो video है या audio।
  Query syntax: https://archive.org/advancedsearch.php
- **नई भाषा स्ट्रिंग जोड़ना:** `js/i18n.js` के `STRINGS` object में key जोड़ें,
  फिर HTML में उस element पर `data-i18n="key"` लगाएं।
- **Player का चुना गया फ़ाइल फॉर्मेट बदलना:** `js/archive.js` में
  `VIDEO_FORMAT_PRIORITY` / `AUDIO_FORMAT_PRIORITY` arrays एडिट करें।

## जानी-मानी सीमाएं (Known limitations)

- Voice search सिर्फ उन ब्राउज़र्स में काम करता है जो Web Speech API सपोर्ट
  करते हैं (Chrome/Edge best; Firefox/Safari में सीमित/अनुपलब्ध हो सकता है) —
  ऐसे में मिक बटन एक friendly "unsupported" मैसेज दिखाता है, टूटता नहीं।
- कुछ पुराने/दुर्लभ archive.org आइटम्स में playable mp4/mp3 फ़ाइल न हो तो
  प्लेयर एक "लोड नहीं हो सका" मैसेज दिखाएगा — ऐसे आइटम पर "archive.org पर
  पूरा पेज खोलें" लिंक से आइटम का असली पेज देखा जा सकता है।
- Save/Library पूरी तरह लोकल (उसी ब्राउज़र/डिवाइस) है — किसी अकाउंट या
  सर्वर से sync नहीं होता।

## ध्यान दें

यह एक **डिज़ाइन/लर्निंग प्रोजेक्ट** है — YouTube का ब्रांड नाम या लोगो
इस्तेमाल नहीं किया गया (placeholder branding "StreamHub")। असली कंटेंट
Internet Archive से आता है, जो पब्लिक डोमेन/ओपन-लाइसेंस्ड कंटेंट वाली एक
non-profit digital library है। पब्लिश/प्रोडक्शन में इस्तेमाल से पहले
archive.org की Terms of Use देख लें: https://archive.org/about/terms.php

# StreamHub — YouTube-inspired Video App UI (powered by archive.org)

Material Design 3 पर आधारित एक video-streaming app UI — pure HTML, CSS और
vanilla JavaScript में बना है, कोई बिल्ड टूल नहीं चाहिए। सारा कंटेंट
**Internet Archive (archive.org)** की public API से लाइव आता है।

## ज़रूरी: लोकल/असली सर्वर से चलाएं

फाइल को सीधे डबल-क्लिक (`file://`) से खोलने पर archive.org की API कॉल्स
ब्राउज़र में ब्लॉक हो सकती हैं। हमेशा एक सर्वर से चलाएं:

```bash
cd video-app
python3 -m http.server 8000
# फिर खोलें: http://localhost:8000
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

## फ़ोल्डर स्ट्रक्चर

```
video-app/
├── index.html        → पूरा ऐप (Home / Library / Player, सब एक फाइल में toggle होते हैं)
├── css/style.css      → डिज़ाइन टोकन, कलर, टाइपोग्राफी, लेआउट
├── js/i18n.js          → भाषा डिक्शनरी (Hindi/English) + toggle लॉजिक
├── js/archive.js        → archive.org API wrapper (search, metadata, फ़ाइल चुनना, downloads)
└── js/app.js              → रेंडरिंग, प्लेयर, सेव/लाइब्रेरी, सर्च, माइक — पूरा ऐप लॉजिक
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

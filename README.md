# StreamHub — YouTube-inspired Video App UI

Material Design 3 पर आधारित एक video-streaming app UI — pure HTML, CSS और
vanilla JavaScript में बना है। किसी भी बिल्ड टूल या इंटरनेट कनेक्शन की ज़रूरत
नहीं (Google Fonts के अलावा, जो optional है)।

## चलाने का तरीका

बस `index.html` को किसी भी ब्राउज़र में खोल दें — डबल-क्लिक करें या
right-click → Open with → Browser.

बेहतर अनुभव के लिए (relative paths सही तरीके से लोड हों) एक लोकल सर्वर से
चलाना सुझाया जाता है:

```bash
cd video-app
python3 -m http.server 8000
# फिर ब्राउज़र में खोलें: http://localhost:8000
```

## फ़ोल्डर स्ट्रक्चर

```
video-app/
├── index.html        → पूरा ऐप (Home feed + Video Player, दोनों एक ही फाइल में toggle होते हैं)
├── css/style.css      → सारे डिज़ाइन टोकन, कलर, टाइपोग्राफी, लेआउट
├── js/archive.js       → archive.org API wrapper (search, metadata, thumbnails, embed URL)
└── js/app.js            → रेंडरिंग लॉजिक, व्यू स्विचिंग, असली प्लेयर एम्बेड
```

## फीचर्स

- **Live content** — पूरा फीड, सर्च और प्लेबैक सीधे **archive.org की public API**
  से आता है (कोई API key नहीं चाहिए)
- **Home Feed** — responsive card grid (mobile पर 1 कॉलम, desktop पर 4),
  असली thumbnails के साथ
- **Filter chips** — archive.org के collections से मैप्ड: मूवीज़, क्लासिक टीवी,
  म्यूज़िक, एनिमेशन, न्यूज़रील्स, NASA, आर्काइव्ड फ़िल्में
- **Search bar** — टॉप बार के search आइकन से archive.org पर सीधे खोजें
- **Video Player screen** — असली archive.org embed player (video/audio दोनों),
  ambient glow effect (thumbnail के रंगों से), असली title/description/creator,
  "archive.org पर पूरा पेज खोलें" लिंक, related items वाला up-next
- **Mini player** — होम पर वापस जाने पर चल रहा वीडियो bottom-right में मिनिमाइज़
  हो जाता है (playback रुकता नहीं — असली iframe DOM में मूव होता है, रीलोड नहीं होता)
- **Bottom navigation** — Home, Shorts, Create, Subscriptions, Library
- **Dark theme** — YouTube जैसा डार्क बेस + red accent (सिर्फ CTA के लिए)
- पूरी तरह **responsive** — mobile से लेकर desktop तक

## ज़रूरी: लोकल सर्वर से चलाएं

Archive.org API को `fetch()` करने के लिए फाइल को सीधे डबल-क्लिक (file://) से
खोलने की बजाय एक लोकल सर्वर से चलाना ज़रूरी है, वरना ब्राउज़र CORS/security
की वजह से रिक्वेस्ट ब्लॉक कर सकता है:

```bash
cd video-app
python3 -m http.server 8000
# फिर ब्राउज़र में खोलें: http://localhost:8000
```

## कस्टमाइज़ करना

- **Collections बदलना:** `index.html` में `#chips` के अंदर हर `<button>` का
  `data-query` attribute archive.org का search query है — इसे अपनी पसंद के
  collection/query से बदल सकते हैं। पूरी query syntax यहाँ देखें:
  https://archive.org/advancedsearch.php
- **Default feed:** `js/app.js` में `DEFAULT_QUERY` सबसे पहले active chip से
  उठता है।

## ध्यान दें

यह एक **डिज़ाइन/लर्निंग प्रोजेक्ट** है — YouTube का ब्रांड नाम या लोगो
इस्तेमाल नहीं किया गया (placeholder branding "StreamHub" है), लेकिन असली
वीडियो कंटेंट अब सीधे **Internet Archive (archive.org)** से लाइव आता है —
यह एक non-profit digital library है और इसका ज़्यादातर कंटेंट पब्लिक डोमेन या
ओपन-लाइसेंस्ड है। फिर भी, इसे पब्लिश/प्रोडक्शन में इस्तेमाल करने से पहले
archive.org की Terms of Use ज़रूर देख लें: https://archive.org/about/terms.php

// Simple i18n: translation dictionary + apply-to-DOM helper.
"use strict";

const I18N = (function () {
  const STRINGS = {
    appName:        { hi: "StreamHub",                          en: "StreamHub" },
    searchPlaceholder:{ hi: "Archive.org पर खोजें… (जैसे: apollo 11, jazz)", en: "Search Archive.org… (e.g. apollo 11, jazz)" },
    micTitle:       { hi: "आवाज़ से खोजें",                      en: "Search by voice" },
    listening:      { hi: "सुन रहा हूँ…",                        en: "Listening…" },
    micUnsupported: { hi: "इस ब्राउज़र में आवाज़ से खोज उपलब्ध नहीं है।", en: "Voice search isn't supported in this browser." },
    micError:       { hi: "माइक शुरू नहीं हो सका — माइक की अनुमति चेक करें।", en: "Couldn't start the microphone — check the mic permission." },
    emptySearch:    { hi: "खोजने के लिए कुछ शब्द लिखें।", en: "Type a few words to search." },
    saveFailed:     { hi: "सेव नहीं हो सका", en: "Couldn't save" },
    chipAll:        { hi: "सभी",              en: "All" },
    chipMovies:     { hi: "मूवीज़",            en: "Movies" },
    chipClassicTv:  { hi: "क्लासिक टीवी",       en: "Classic TV" },
    chipMusic:      { hi: "म्यूज़िक",           en: "Music" },
    chipAnimation:  { hi: "एनिमेशन",           en: "Animation" },
    chipNewsreels:  { hi: "न्यूज़रील्स",         en: "Newsreels" },
    chipNasa:       { hi: "NASA",             en: "NASA" },
    chipArchived:   { hi: "आर्काइव्ड फ़िल्में",   en: "Archived Films" },
    chipPdf:        { hi: "PDF / किताबें",     en: "PDF / Books" },
    feedNote:       { hi: "Internet Archive से लाइव कंटेंट लोड हो रहा है — सारा कंटेंट",  en: "Live content loading from Internet Archive — everything comes from" },
    loading:        { hi: "लोड हो रहा है…",      en: "Loading…" },
    noResults:      { hi: "कोई नतीजा नहीं मिला।", en: "No results found." },
    loadFailed:      { hi: "archive.org से लोड नहीं हो सका — इंटरनेट कनेक्शन चेक करें।", en: "Couldn't load from archive.org — check your internet connection." },
    downloads:      { hi: "डाउनलोड",  en: "Download" },
    share:          { hi: "शेयर",     en: "Share" },
    save:           { hi: "सेव",      en: "Save" },
    saved:          { hi: "सेव्ड",    en: "Saved" },
    linkCopied:     { hi: "लिंक कॉपी हो गया",  en: "Link copied" },
    openArchive:    { hi: "archive.org पर पूरा पेज खोलें ↗", en: "Open full page on archive.org ↗" },
    archiveItem:    { hi: "Internet Archive आइटम", en: "Internet Archive item" },
    archiveStreamNote:{ hi: "यह कंटेंट सीधे archive.org से स्ट्रीम हो रहा है।", en: "This content streams directly from archive.org." },
    upNext:         { hi: "आगे क्या देखें", en: "Up next" },
    comments:       { hi: "कमेंट्स",        en: "Comments" },
    commentsDisabled:{ hi: "इस आइटम पर कमेंट्स उपलब्ध नहीं हैं। पूरी चर्चा archive.org पेज पर देखें।", en: "Comments aren't available for this item. See the full discussion on the archive.org page." },
    downloadFiles:  { hi: "उपलब्ध फ़ाइलें",  en: "Available files" },
    noDownloads:    { hi: "कोई डाउनलोड फ़ाइल नहीं मिली।", en: "No downloadable files found." },
    navHome:        { hi: "होम",       en: "Home" },
    navLibrary:     { hi: "लाइब्रेरी", en: "Library" },
    libraryTitle:   { hi: "सेव्ड और वॉच लेटर", en: "Saved & Watch Later" },
    libraryEmpty:   { hi: "अभी तक कुछ भी सेव नहीं किया गया। किसी वीडियो पर 'सेव' दबाएं।", en: "Nothing saved yet. Tap 'Save' on any video." },
    remove:         { hi: "हटाएं", en: "Remove" },
    description:    { hi: "विवरण",  en: "Description" },
    noDescription:  { hi: "इस आइटम के लिए कोई विवरण उपलब्ध नहीं है।", en: "No description available for this item." },
    descFailed:     { hi: "विवरण लोड नहीं हो सका।", en: "Couldn't load description." },
    views:          { hi: "डाउनलोड्स", en: "downloads" },
    audioNote:      { hi: "ऑडियो", en: "Audio" },
    documentNote:   { hi: "डॉक्यूमेंट", en: "Document" },
    pdfPreviewTitle:{ hi: "डॉक्यूमेंट प्रीव्यू", en: "Document preview" },
    pdfNoPreview:   { hi: "इस फ़ाइल का सीधा प्रीव्यू उपलब्ध नहीं है — नीचे डाउनलोड या 'archive.org पर खोलें' लिंक इस्तेमाल करें।", en: "A direct preview isn't available for this file — use the download or 'open on archive.org' link below." },
  };

  let current = "hi";
  try {
    const stored = localStorage.getItem("sh_lang");
    if (stored === "en" || stored === "hi") current = stored;
  } catch { /* storage blocked — fall back to the default language */ }

  function t(key) {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[current] || entry.hi;
  }

  function lang() { return current; }

  /** BCP-47 tag for the active language — used for Intl + SpeechRecognition. */
  function localeTag() { return current === "en" ? "en-US" : "hi-IN"; }

  function setLang(l) {
    current = l === "en" ? "en" : "hi";
    try { localStorage.setItem("sh_lang", current); }
    catch { /* private mode / blocked storage — keep the in-memory choice */ }
    apply();
  }

  function toggle() {
    setLang(current === "hi" ? "en" : "hi");
  }

  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const text = t(el.dataset.i18nTitle);
      el.setAttribute("title", text);
      // icon-only buttons carry the same text as their accessible name
      if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", text);
    });
    // short inline strings inside generated markup (e.g. the "downloads" label
    // on every feed card). They carry their own key attribute so a language
    // switch updates them without rebuilding the list.
    document.querySelectorAll("[data-i18n-inline]").forEach(el => {
      el.textContent = t(el.dataset.i18nInline);
    });
    const langBtn = document.getElementById("langToggle");
    if (langBtn) langBtn.textContent = current === "hi" ? "EN" : "हिं";
    // keep <html lang> in sync even on first load from a stored preference
    document.documentElement.lang = current;
    document.dispatchEvent(new CustomEvent("i18n:changed"));
  }

  return { t, lang, localeTag, setLang, toggle, apply };
})();

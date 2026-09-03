// DOM-level smoke test: loads index.html in jsdom with a mocked archive.org
// API and drives the main user flows end-to-end.
// Run with: npm test
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---- canned archive.org responses ---- */
const DOCS = [
  { identifier: "sample_movie", title: "Sample Classic Movie", creator: "Test Studio", downloads: 1500, mediatype: "movies", publicdate: "2020-01-05T00:00:00Z" },
  { identifier: "sample_movie2", title: "A Second Classic", creator: "Other Studio", downloads: 3000, mediatype: "movies", publicdate: "2021-02-03T00:00:00Z" },
  { identifier: "sample_audio", title: "Sample Jazz Album", creator: ["Test Band"], downloads: 250000, mediatype: "audio", publicdate: "2019-06-01T00:00:00Z" },
  { identifier: "sample_book", title: "Sample Rare Book", creator: "Public Library", downloads: 700, mediatype: "texts", publicdate: "1998-04-05T00:00:00Z" }
];

const METADATA = {
  metadata: {
    identifier: "sample_movie",
    title: "Sample Classic Movie",
    creator: ["Test Studio"],
    publicdate: "2020-01-05T00:00:00Z",
    mediatype: "movies",
    subject: ["classic", "feature"],
    description: "<b>Bold</b> description text"
  },
  files: [
    { name: "a.mp4", format: "h.264", size: "8388608" },
    { name: "poster.jpg", format: "JPEG", size: "1024" },
    // archive.org metadata is user supplied — a hostile "format" must not turn into markup
    { name: "weird.bin", format: '<img src=x onerror=alert(1)>', size: "2048" },
    { name: "sample_movie_files.xml", format: "Metadata", size: "2200" }
  ]
};

const METADATA_AUDIO = {
  metadata: {
    identifier: "sample_audio",
    title: "Sample Jazz Album",
    creator: ["Test Band"],
    publicdate: "2019-06-01T00:00:00Z",
    mediatype: "audio",
    description: "A lovely jazz record"
  },
  files: [
    { name: "a.mp3", format: "VBR MP3", size: "4194304" },
    { name: "cover.png", format: "PNG", size: "2048" }
  ]
};

const METADATA_BOOK = {
  metadata: {
    identifier: "sample_book",
    title: "Sample Rare Book",
    creator: ["Public Library"],
    publicdate: "1998-04-05T00:00:00Z",
    mediatype: "texts",
    description: "A scanned volume"
  },
  files: [
    { name: "book.pdf", format: "Text PDF", size: "1048576" },
    { name: "book_djvu.xml", format: "Metadata", size: "512" }
  ]
};

const METADATA_BY_ID = {
  sample_movie: METADATA,
  sample_movie2: METADATA,
  sample_audio: METADATA_AUDIO,
  sample_book: METADATA_BOOK
};

/* ---- build the page ---- */
const html = readFileSync(resolve(root, "index.html"), "utf8");
const dom = new JSDOM(html, {
  url: "http://localhost:8000/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

window.localStorage.clear();
window.scrollTo = () => {}; // jsdom: not implemented
// jsdom doesn't ship a working media element — stub the methods the player uses
window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};

const fetchedUrls = [];
window.fetch = async url => {
  fetchedUrls.push(String(url));
  const target = String(url);
  let body;
  if (target.includes("advancedsearch.php")) body = { response: { docs: DOCS } };
  else {
    const m = target.match(/\/metadata\/([^/?]+)/);
    if (!m) throw new Error("unexpected fetch: " + target);
    body = METADATA_BY_ID[m[1]] || METADATA;
  }
  return { ok: true, status: 200, json: async () => body };
};

/* ---- run the app scripts in the page context ----
   The three files share one top-level lexical scope (app.js references the
   `const Archive` from archive.js and `const I18N` from i18n.js). */
window.eval(
  readFileSync(resolve(root, "js/i18n.js"), "utf8") + "\n" +
  readFileSync(resolve(root, "js/archive.js"), "utf8") + "\n" +
  readFileSync(resolve(root, "js/app.js"), "utf8") + "\n" +
  // test hooks: `const` in eval'd code lives in the eval scope only, so hand the
  // modules to the harness — this lets tests swap Archive.search for a fake.
  ";window.__Archive = Archive; window.__I18N = I18N;"
);
const realSearch = window.__Archive.search;
function patchSearch(fn) { window.__Archive.search = fn; }
function restoreSearch() { window.__Archive.search = realSearch; }
await wait(80);

/* ---- 1. home feed renders cards from the API (video docs only by default) ---- */
const cards = document.querySelectorAll("#videoGrid .card");
assert.equal(cards.length, 2, "feed should render 2 video cards");
assert.ok(cards[0].textContent.includes("Sample Classic Movie"), "card shows item title");
assert.ok(document.getElementById("homeView").hidden === false, "home view visible at start");
assert.ok(document.getElementById("playerView").hidden, "player hidden at start");
assert.ok(document.getElementById("searchBar").hidden, "search bar must stay hidden initially");

/* ---- 2. filter chip reloads the feed with a mediatype-scoped query ---- */
fetchedUrls.length = 0;
document.querySelector('.chip[data-query*="classic_tv"]').click();
await wait(80);
const chipUrl = [...fetchedUrls].reverse().find(u => u.includes("advancedsearch.php"));
assert.ok(chipUrl, "chip click triggers a new search");
const chipQ = new URLSearchParams(chipUrl.split("?")[1]).get("q");
assert.ok(chipQ.startsWith("mediatype:(movies) AND ("), "video chips always scope to mediatype:(movies)");
assert.ok(document.getElementById("feedStatus").hidden, "feed status hidden after successful load");

/* ---- 3. search box: query wrapped + search run ---- */
fetchedUrls.length = 0;
const input = document.getElementById("searchInput");
input.value = 'charlie (chaplin)":';
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(80);
const searchUrl = [...fetchedUrls].reverse().find(u => u.includes("advancedsearch.php"));
assert.ok(searchUrl, "search triggers a request");
const qParam = new URLSearchParams(searchUrl.split("?")[1]).get("q");
assert.equal(
  qParam,
  "mediatype:(movies) AND (title:(charlie chaplin) OR subject:(charlie chaplin) OR description:(charlie chaplin))",
  "user input is sanitised — Lucene metacharacters are stripped before the query is built"
);
assert.ok(
  !/["():]/.test(
    qParam.replace(/mediatype:\(movies\) AND \(|title:\(|subject:\(|description:\(|\)/g, "")
  ),
  "no user-supplied metacharacter survives inside the wrapped query"
);
assert.equal(document.getElementById("searchBar").hidden, true, "search bar closes after search");

/* ---- 4. mic: unsupported browsers get a friendly message, not a crash ---- */
document.getElementById("micBtn").click();
assert.equal(document.getElementById("micStatus").hidden, false, "mic status appears");
assert.ok(document.getElementById("micStatus").textContent.includes("आवाज़"), "unsupported message shown in Hindi");

/* ---- 5. opening a video: custom native player (no third-party iframe) ---- */
fetchedUrls.length = 0;
document.querySelector('#videoGrid .card').click();
await wait(100);
assert.equal(document.getElementById("playerView").hidden, false, "player view becomes visible");
assert.equal(document.getElementById("homeView").hidden, true, "home view hidden");
const media = document.querySelector("#player video.media-el");
assert.ok(media, "custom <video> element is mounted in the player");
assert.ok(!document.querySelector("#player .archive-iframe"), "no archive.org embed iframe for video");
assert.ok(media.src.endsWith("/download/sample_movie/a.mp4"), "video src points at a direct archive.org file");
assert.equal(document.getElementById("pTitle").textContent, "Sample Classic Movie", "title filled from metadata");
assert.ok(document.getElementById("pMetaLine").textContent.includes("2020-01-05"), "meta line shows release date");
assert.ok(document.getElementById("pDesc").textContent.includes("description text"), "description rendered as text (HTML stripped)");
assert.ok(document.getElementById("openArchiveLink").href.endsWith("/details/sample_movie"), "details link set");
assert.ok(fetchedUrls.some(u => u.includes("/metadata/sample_movie")), "metadata fetched");
assert.ok(document.querySelectorAll("#upNext .up-card").length > 0, "up-next list rendered");

/* ---- 6. download panel lists direct file links ---- */
assert.equal(document.getElementById("downloadPanel").hidden, true, "download panel closed by default");
document.getElementById("downloadBtn").click();
assert.equal(document.getElementById("downloadPanel").hidden, false, "download panel opens");
const rows = document.querySelectorAll("#downloadList a.download-row");
assert.ok(rows.length > 0, "download rows rendered");
assert.ok(rows[0].textContent.includes("a.mp4"), "download row lists the media file");

/* ---- 7. save to library (localStorage) ---- */
document.getElementById("saveBtn").click();
const saved = JSON.parse(window.localStorage.getItem("sh_saved_items"));
assert.ok(saved && saved[0].identifier === "sample_movie", "saved item stored");
assert.equal(document.getElementById("saveBtn").querySelector("span").textContent, "सेव्ड", "save button flips to Saved");

/* ---- 8. music chip → audio item uses native <audio> + artwork stage ---- */
document.getElementById("backBtn").click();
await wait(30);
document.querySelector('.chip[data-query*="etree"]').click();
await wait(80);
const audioCard = document.querySelector('#videoGrid .card[data-kind="audio"]');
assert.ok(audioCard, "audio card rendered in music feed");
audioCard.click();
await wait(100);
const audioEl = document.querySelector("#player audio.media-el");
assert.ok(audioEl, "custom <audio> element mounted for audio items");
assert.ok(audioEl.src.endsWith("/download/sample_audio/a.mp3"), "audio src points at direct mp3");
assert.equal(document.getElementById("audioStage").hidden, false, "audio artwork stage visible");

/* ---- 9. mini player keeps the live element when leaving the player ---- */
document.getElementById("backBtn").click();
await wait(50);
const mini = document.getElementById("miniPlayer");
assert.equal(mini.hidden, false, "mini player visible when returning home during playback");
assert.ok(document.querySelector("#miniVideoSlot audio.media-el"), "live <audio> element moved into mini player");
document.getElementById("miniClose").click();
assert.equal(mini.hidden, true, "mini player closes via X button");

/* ---- 10. library shows saved items ---- */
document.querySelector('.nav-item[data-view="library"]').click();
await wait(30);
assert.equal(document.getElementById("libraryView").hidden, false, "library view opens");
assert.equal(document.querySelectorAll("#libraryGrid .card").length, 1, "saved card rendered in library");
assert.equal(document.getElementById("libraryEmpty").hidden, true, "empty state hidden when items exist");

/* ---- 11. PDF/Books chip opens the document reader (iframe.pdf-frame) ---- */
document.querySelector('.nav-item[data-view="home"]').click();
await wait(30);
document.querySelector('.chip[data-kind="text"]').click();
await wait(80);
const bookCard = document.querySelector('#videoGrid .card[data-kind="text"]');
assert.ok(bookCard, "text card rendered in PDF feed");
bookCard.click();
await wait(100);
const pdfFrame = document.querySelector("#player iframe.pdf-frame");
assert.ok(pdfFrame, "PDF reader iframe mounted");
assert.ok(pdfFrame.src.endsWith("/download/sample_book/book.pdf"), "PDF iframe points at direct file");
assert.ok(document.getElementById("player").classList.contains("doc-mode"), "player switches to document mode");

/* ---- 12. language toggle switches UI strings to English ---- */
assert.equal(document.documentElement.lang, "hi", "starts in Hindi");
document.getElementById("langToggle").click();
assert.equal(document.documentElement.lang, "en", "html lang switches to English");
assert.equal(document.querySelector('[data-i18n="navHome"]').textContent, "Home", "nav label now English");
assert.equal(document.getElementById("langToggle").textContent, "हिं", "toggle button label flips");

/* ===================== REGRESSION TESTS FOR FIXED BUGS ===================== */

/* ---- 13. the `hidden` attribute must survive author display rules ---- */
{
  const css = readFileSync(resolve(root, "css/style.css"), "utf8");
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/,
    "stylesheet must force [hidden]{display:none} — otherwise .mini-player/.chips/" +
    ".icon-btn/.player-loading{display:flex} override the UA rule and stay visible");
}

/* ---- 14. the up-next rail is a real grid child (desktop 2-column layout) ---- */
assert.equal(document.getElementById("upNext").parentElement.id, "playerView",
  "#upNext must be a direct child of .player-view for grid-column:2 to apply");
assert.equal(document.getElementById("commentsDisabled").parentElement.id, "playerView",
  "#commentsDisabled belongs to the same rail");

/* ---- 15. wide screens hide the bottom nav, so the top bar needs both tabs ---- */
assert.ok(document.getElementById("topLibraryBtn"), "top bar has a Library shortcut");
document.getElementById("topLibraryBtn").click();
await wait(30);
assert.equal(document.getElementById("libraryView").hidden, false, "top-bar Library button opens the library");
assert.equal(document.getElementById("playerView").hidden, true, "player closes when switching to the library");
assert.ok(document.getElementById("topLibraryBtn").classList.contains("active"), "top-bar Library button shows active state");
assert.ok(document.querySelector('.nav-item[data-view="library"]').classList.contains("active"), "bottom nav stays in sync");

/* ---- 16. Back returns to the list the item was opened from ---- */
document.querySelector("#libraryGrid .card").click();
await wait(100);
assert.equal(document.getElementById("playerView").hidden, false, "item opens from the library");
document.getElementById("backBtn").click();
await wait(30);
assert.equal(document.getElementById("libraryView").hidden, false, "Back returns to the library, not Home");
assert.ok(document.querySelector('.nav-item[data-view="library"]').classList.contains("active"),
  "bottom nav highlights Library after going back");

/* ---- 17. searching from inside the player leaves the player ---- */
document.querySelector("#libraryGrid .card").click();
await wait(100);
document.getElementById("searchBtn").click();
input.value = "apollo";
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(80);
assert.equal(document.getElementById("playerView").hidden, true, "player closes when a search runs");
assert.equal(document.getElementById("homeView").hidden, false, "search results land in the visible home feed");
assert.equal(document.getElementById("chips").hidden, false, "chips are visible again after searching");
assert.equal(document.getElementById("searchBar").hidden, true, "search bar closes after searching");

/* ---- 18. search keeps the mediatype of the selected chip ---- */
fetchedUrls.length = 0;
document.querySelector('.chip[data-kind="text"]').click();
await wait(80);
document.getElementById("searchBtn").click();
input.value = "rare book";
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(80);
const pdfSearchQ = new URLSearchParams(
  [...fetchedUrls].reverse().find(u => u.includes("advancedsearch.php")).split("?")[1]
).get("q");
assert.ok(pdfSearchQ.startsWith("mediatype:(texts)"),
  "searching while the PDF chip is active stays inside mediatype:(texts) — got: " + pdfSearchQ);

/* ---- 19. punctuation-only input is not sent as a broken query ---- */
fetchedUrls.length = 0;
document.getElementById("searchBtn").click();
input.value = '":()??';
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(50);
assert.equal(fetchedUrls.filter(u => u.includes("advancedsearch.php")).length, 0,
  "an empty search term must not fire a request");
assert.equal(document.getElementById("feedStatus").hidden, false, "status message shown instead");
assert.ok(document.getElementById("feedStatus").textContent.length > 0, "status message is not blank");

/* ---- 20. an out-of-order response must not overwrite the newest feed ---- */
const searchQueue = [];
patchSearch(async (query, rows, kind) => {
  if (rows !== 16) return [];                  // only feed requests, not "up next"
  const call = searchQueue.shift() || { delay: 0, docs: [] };
  await new Promise(r => setTimeout(r, call.delay));
  const expected = kind === "audio" ? "audio" : kind === "text" ? "texts" : "movies";
  return call.docs.filter(d => d.mediatype === expected);
});
searchQueue.push(
  { delay: 160, docs: [{ identifier: "stale_item", title: "Stale Result", creator: "A", downloads: 10, mediatype: "movies" }] },
  { delay: 5,   docs: [{ identifier: "fresh_item", title: "Fresh Result", creator: "B", downloads: 1500, mediatype: "movies" }] }
);
document.querySelector('.chip[data-query*="classic_tv"]').click();   // slow response…
document.querySelector('.chip[data-query*="nasa"]').click();         // …overtaken by a fast one
await wait(300);
{
  const ids = [...document.querySelectorAll("#videoGrid .card")].map(c => c.dataset.id);
  assert.deepEqual(ids, ["fresh_item"], "the late first response is discarded, only the newest feed is rendered");
}

/* ---- 21. switching language repaints counts + inline labels ---- */
assert.ok(document.querySelector("#videoGrid .card-meta").textContent.includes("1.5K"),
  "download counts are formatted for the active language (en) — got: " +
  document.querySelector("#videoGrid .card-meta").textContent);
document.getElementById("langToggle").click();  // -> Hindi
// note: Intl joins the number and the unit with U+00A0, so match on the word only
assert.ok(document.querySelector("#videoGrid .card-meta").textContent.includes("हज़ार"),
  "download counts re-format in Hindi without a refetch — got: " +
  document.querySelector("#videoGrid .card-meta").textContent);
assert.equal(document.querySelector('#videoGrid [data-i18n-inline="views"]').textContent, "डाउनलोड्स",
  "inline data-i18n labels are translated on language switch");
document.getElementById("langToggle").click();  // -> back to English

/* ---- 22. stored language preference is applied on first load ---- */
{
  const langDom = new JSDOM(html, { url: "http://localhost:8000/", runScripts: "outside-only", pretendToBeVisual: true });
  langDom.window.localStorage.setItem("sh_lang", "en");
  // app.js calls I18N.apply() on boot; do the same here
  langDom.window.eval(
    readFileSync(resolve(root, "js/i18n.js"), "utf8") +
    ";I18N.apply();window.__I18N = I18N;"   // app.js calls apply() on boot
  );
  assert.equal(langDom.window.document.documentElement.lang, "en",
    "<html lang> follows the stored preference on first load");
  assert.equal(langDom.window.__I18N.t("navHome"), "Home", "strings load in the stored language");
  assert.equal(langDom.window.__I18N.localeTag(), "en-US", "localeTag() matches the language");
  assert.equal(langDom.window.document.querySelector('[data-i18n="navHome"]').textContent, "Home",
    "static labels are translated on first load");
  langDom.window.close();
}

/* ---- 23. time formatting + infinite-duration streams ---- */
restoreSearch();
document.querySelector('.chip[data-query*="nasa"]').click();
await wait(80);
document.querySelector("#videoGrid .card").click();
await wait(100);
{
  const v = document.querySelector("#player video.media-el");
  assert.ok(v, "video element mounted");
  Object.defineProperty(v, "duration", { value: 3725, configurable: true });
  v.dispatchEvent(new window.Event("loadedmetadata"));
  assert.equal(document.getElementById("durTime").textContent, "1:02:05",
    "durations over an hour use h:mm:ss, not 62:05");
  Object.defineProperty(v, "duration", { value: Infinity, configurable: true });
  Object.defineProperty(v, "currentTime", { value: 42, configurable: true, writable: true });
  v.dispatchEvent(new window.Event("timeupdate"));
  assert.equal(document.getElementById("progressFill").style.width, "0%",
    "a live stream (duration Infinity) must not set the progress bar to NaN%");
  assert.equal(document.getElementById("curTime").textContent, "0:42", "elapsed time still counts up");
}

/* ---- 24. mute state does not leak into the next item ---- */
document.getElementById("muteToggle").click();
assert.equal(document.querySelector("#muteToggle .ic-mute").hidden, false, "mute icon shown while muted");
document.getElementById("backBtn").click();
await wait(30);
document.querySelectorAll("#videoGrid .card")[1].click();
await wait(100);
assert.equal(document.querySelector("#muteToggle .ic-mute").hidden, true,
  "a freshly loaded item starts unmuted — icons must be re-synced");
assert.equal(document.querySelector("#muteToggle .ic-vol").hidden, false, "volume icon shown for the new item");

/* ---- 25. tabs reset when another item is opened ---- */
document.querySelector('.tab[data-tab="comments"]').click();
assert.equal(document.getElementById("upNext").hidden, true, "comments tab hides the up-next rail");
document.getElementById("backBtn").click();
await wait(30);
document.querySelector("#videoGrid .card").click();
await wait(100);
assert.equal(document.getElementById("upNext").hidden, false, "opening a new item resets to the Up next tab");
assert.equal(document.getElementById("commentsDisabled").hidden, true, "comments notice hidden again");
assert.ok(document.querySelector('.tab[data-tab="next"]').classList.contains("active"), "Up next tab active again");

/* ---- 26. fullscreen only offered for video ---- */
assert.equal(document.getElementById("fullscreenBtn").hidden, false, "fullscreen available for video");
document.getElementById("backBtn").click();
await wait(30);
document.querySelector('.chip[data-query*="etree"]').click();
await wait(80);
document.querySelector('#videoGrid .card[data-kind="audio"]').click();
await wait(100);
assert.equal(document.getElementById("fullscreenBtn").hidden, true, "fullscreen hidden for audio items");

/* ---- 27. hostile archive.org metadata is escaped, not injected ---- */
document.getElementById("backBtn").click();
await wait(30);
patchSearch(async () => [{
  identifier: "evil_item",
  title: '<img src=x onerror=alert(1)>Title',
  creator: '"><script>alert(2)</script>',
  downloads: 5,
  mediatype: "movies"
}]);
document.querySelector('.chip[data-query*="nasa"]').click();
await wait(80);
assert.equal(document.querySelectorAll("#videoGrid .card").length, 1, "hostile doc still renders as one card");
assert.ok(!document.querySelector("#videoGrid script"), "no <script> injected from creator metadata");
assert.ok(!document.querySelector("#videoGrid .card-body img"), "no <img> injected from creator initials");
assert.ok(document.getElementById("videoGrid").innerHTML.includes("&lt;img"), "markup is escaped");
assert.equal(document.querySelector("#videoGrid .card-title").textContent, '<img src=x onerror=alert(1)>Title',
  "title text is preserved verbatim");
// the download list interpolates archive-supplied "format" strings too
restoreSearch();
document.querySelector('.chip[data-query*="nasa"]').click();
await wait(80);
document.querySelector("#videoGrid .card").click();
await wait(100);
document.getElementById("downloadBtn").click();
assert.ok(!document.querySelector("#downloadList img"), "no <img> injected via the download list");
assert.ok(document.getElementById("downloadList").innerHTML.includes("&lt;img"),
  "download format strings are escaped");

/* ---- 28. blocked localStorage: Save reports it instead of throwing ---- */
{
  const save = document.getElementById("saveBtn");
  // Storage is a named-property object: assigning `localStorage.setItem = …`
  // would just store a key called "setItem", so patch the prototype instead.
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const originalSetItem = storageProto.setItem;
  const savedIds = () => JSON.parse(window.localStorage.getItem("sh_saved_items") || "[]").map(i => i.identifier);

  assert.ok(savedIds().includes("sample_movie"), "precondition: the open item is saved");
  save.click();
  assert.equal(save.querySelector("span").textContent, "Save", "un-saving works and updates the button");

  storageProto.setItem = function () { throw new Error("QuotaExceededError"); };
  save.click();
  assert.equal(save.querySelector("span").textContent, "Couldn't save",
    "a storage failure is reported on the button instead of throwing");
  assert.deepEqual(savedIds(), [], "nothing was written while storage was blocked");

  storageProto.setItem = originalSetItem;
  save.click();
  assert.deepEqual(savedIds(), ["sample_movie"], "the item is stored again once storage works");
  assert.equal(save.querySelector("span").textContent, "Saved", "button flips back to Saved");
}

dom.window.close(); // stop pending jsdom timers
console.log("✓ smoke test passed: feed, chips, search, mic, custom player, downloads, save/library, mini player, PDF reader, i18n");
console.log("✓ regression suite passed: [hidden] CSS, grid rail, nav sync, search sanitising + races, i18n repaint, player time/mute/tabs, metadata escaping, storage failures");

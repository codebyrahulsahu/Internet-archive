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
  readFileSync(resolve(root, "js/app.js"), "utf8")
);
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
  'mediatype:(movies) AND (title:(charlie (chaplin)":) OR subject:(charlie (chaplin)":) OR description:(charlie (chaplin)":))',
  "user input is wrapped in title/subject/description query under a movies filter"
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

dom.window.close(); // stop pending jsdom timers
console.log("✓ smoke test passed: feed, chips, search, mic, custom player, downloads, save/library, mini player, PDF reader, i18n");

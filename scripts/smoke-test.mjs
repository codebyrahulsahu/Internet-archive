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
  { identifier: "sample_audio", title: "Sample Jazz Album", creator: ["Test Band"], downloads: 250000, mediatype: "audio", publicdate: "2019-06-01T00:00:00Z" }
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
  files: [{ name: "a.mp4" }, { name: "b.mp4" }, { name: "c.mp4" }]
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

window.scrollTo = () => {}; // jsdom: not implemented
const fetchedUrls = [];
window.fetch = async url => {
  fetchedUrls.push(String(url));
  const target = String(url);
  let body;
  if (target.includes("advancedsearch.php")) body = { response: { docs: DOCS } };
  else if (target.includes("/metadata/")) body = METADATA;
  else throw new Error("unexpected fetch: " + target);
  return { ok: true, status: 200, json: async () => body };
};

/* ---- run the app scripts in the page context ----
   A single eval() keeps the browser's shared top-level lexical scope
   (js/app.js references the `const Archive` from js/archive.js). */
window.eval(
  readFileSync(resolve(root, "js/archive.js"), "utf8") + "\n" +
  readFileSync(resolve(root, "js/app.js"), "utf8")
);
await wait(80);

/* ---- 1. home feed renders cards from the API ---- */
const cards = document.querySelectorAll("#videoGrid .card");
assert.equal(cards.length, 2, "feed should render 2 cards");
assert.ok(cards[0].textContent.includes("Sample Classic Movie"), "card shows item title");
assert.ok(document.getElementById("homeView").hidden === false, "home view visible at start");
assert.ok(document.getElementById("playerView").hidden, "player hidden at start");
assert.ok(document.getElementById("searchBar").hidden, "search bar must stay hidden initially (CSS display bug guard)");

/* ---- 2. filter chip reloads the feed ---- */
fetchedUrls.length = 0;
document.querySelector('.chip[data-query*="classic_tv"]').click();
await wait(80);
assert.ok(fetchedUrls.some(u => u.includes("advancedsearch.php")), "chip click triggers a new search");

/* ---- 3. search box: query sanitization + search run ---- */
const input = document.getElementById("searchInput");
input.value = 'charlie (chaplin)":';
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(80);
const searchUrl = [...fetchedUrls].reverse().find(u => u.includes("advancedsearch.php")); // latest search
assert.ok(searchUrl, "search triggers a request");
const qParam = new URLSearchParams(searchUrl.split("?")[1]).get("q");
assert.equal(
  qParam,
  "title:(charlie chaplin) OR subject:(charlie chaplin) OR creator:(charlie chaplin)",
  "user input sanitized (parens/quotes stripped) and wrapped in the query"
);
assert.equal(document.getElementById("searchBar").hidden, true, "search bar closes after search");

/* ---- 4. opening a video ---- */
fetchedUrls.length = 0;
document.querySelector('#videoGrid .card').click();
await wait(100);
assert.equal(document.getElementById("playerView").hidden, false, "player view becomes visible");
assert.equal(document.getElementById("homeView").hidden, true, "home view hidden");
const iframe = document.querySelector("#player .archive-iframe");
assert.ok(iframe, "embed iframe is mounted in the player");
assert.ok(iframe.src.includes("/embed/sample_movie"), "iframe points at archive.org embed");
assert.equal(document.getElementById("pTitle").textContent, "Sample Classic Movie", "title filled from metadata");
assert.ok(document.getElementById("pDesc").textContent.includes("description text"), "description rendered as text (HTML stripped)");
assert.ok(document.getElementById("openArchiveLink").href.endsWith("/details/sample_movie"), "details link set");
assert.ok(fetchedUrls.some(u => u.includes("/metadata/sample_movie")), "metadata fetched");
assert.equal(document.getElementById("itemInfo").hidden, true, "info tab hidden by default");
assert.ok(document.querySelectorAll("#upNext .up-card").length > 0, "up-next list rendered");

/* ---- 5. watch history recorded, library shows it ---- */
const stored = JSON.parse(window.localStorage.getItem("streamhub:history"));
assert.ok(stored && stored[0].identifier === "sample_movie", "history entry saved");
document.querySelector('.nav-item[data-view="library"]').click();
await wait(30);
assert.equal(document.getElementById("libraryView").hidden, false, "library view opens");
assert.equal(document.getElementById("homeView").hidden, true, "home hidden while in library");
assert.equal(document.querySelectorAll("#historyGrid .card").length, 1, "history card rendered");
assert.equal(document.getElementById("historyEmpty").hidden, true, "empty state hidden when history exists");

/* ---- 6. clear history ---- */
document.getElementById("clearHistoryBtn").click();
await wait(30);
assert.equal(JSON.parse(window.localStorage.getItem("streamhub:history")).length, 0, "history cleared");
assert.equal(document.getElementById("historyEmpty").hidden, false, "empty state shown after clearing");

/* ---- 7. placeholder nav (shorts) ---- */
document.querySelector('.nav-item[data-view="shorts"]').click();
await wait(30);
assert.equal(document.getElementById("placeholderView").hidden, false, "placeholder view opens for shorts");
assert.equal(document.getElementById("placeholderTitle").textContent, "शॉर्ट्स", "placeholder title set");

/* ---- 8. browser back works with the History API (shorts → library → player) ---- */
window.history.back();
await wait(80);
assert.equal(document.getElementById("libraryView").hidden, false, "back from shorts returns to the previous view (library)");

window.history.back();
await wait(150);
assert.equal(document.getElementById("playerView").hidden, false, "back from library re-opens the video");
assert.ok(document.querySelector("#player .archive-iframe"), "iframe is mounted in the main player again");

/* ---- 9. mini player appears when leaving an active video ---- */
document.querySelector('.nav-item[data-view="home"]').click();
await wait(50);
const mini = document.getElementById("miniPlayer");
assert.equal(mini.hidden, false, "mini player visible when returning home during playback");
assert.ok(document.querySelector("#miniVideoSlot .archive-iframe"), "live iframe moved into mini player");
document.getElementById("miniClose").click();
assert.equal(mini.hidden, true, "mini player closes via X button");

console.log("✓ smoke test passed: feed, chips, search, player, history, library, nav, back-button, mini player");

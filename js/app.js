(function () {
  "use strict";

  /* ---------- element refs ---------- */
  const grid = document.getElementById("videoGrid");
  const feedStatus = document.getElementById("feedStatus");
  const homeView = document.getElementById("homeView");
  const libraryView = document.getElementById("libraryView");
  const libraryGrid = document.getElementById("libraryGrid");
  const libraryEmpty = document.getElementById("libraryEmpty");
  const playerView = document.getElementById("playerView");
  const upNextList = document.getElementById("upNext");
  const commentsDisabled = document.getElementById("commentsDisabled");
  const backBtn = document.getElementById("backBtn");
  const brandLogo = document.getElementById("brandLogo");
  const chips = document.getElementById("chips");
  const bottomNav = document.getElementById("bottomNav");
  const topHomeBtn = document.getElementById("topHomeBtn");
  const topLibraryBtn = document.getElementById("topLibraryBtn");

  const miniPlayer = document.getElementById("miniPlayer");
  const miniVideoSlot = document.getElementById("miniVideoSlot");
  const miniTitle = document.getElementById("miniTitle");
  const miniChannel = document.getElementById("miniChannel");
  const miniClose = document.getElementById("miniClose");
  const miniPlayToggle = document.getElementById("miniPlayToggle");

  const ambientGlow = document.getElementById("ambientGlow");
  const player = document.getElementById("player");
  const playerLoading = document.getElementById("playerLoading");
  const audioStage = document.getElementById("audioStage");
  const audioArt = document.getElementById("audioArt");
  const pdfFallback = document.getElementById("pdfFallback");
  const customControls = document.getElementById("customControls");
  const playToggle = document.getElementById("playToggle");
  const progressTrack = document.getElementById("progressTrack");
  const progressFill = document.getElementById("progressFill");
  const curTimeEl = document.getElementById("curTime");
  const durTimeEl = document.getElementById("durTime");
  const muteToggle = document.getElementById("muteToggle");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  const pTitle = document.getElementById("pTitle");
  const pAvatar = document.getElementById("pAvatar");
  const pChannel = document.getElementById("pChannel");
  const pMetaLine = document.getElementById("pMetaLine");
  const pDesc = document.getElementById("pDesc");
  const openArchiveLink = document.getElementById("openArchiveLink");
  const shareBtn = document.getElementById("shareBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadPanel = document.getElementById("downloadPanel");
  const downloadList = document.getElementById("downloadList");
  const saveBtn = document.getElementById("saveBtn");

  const searchBtn = document.getElementById("searchBtn");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");
  const searchClose = document.getElementById("searchClose");
  const micBtn = document.getElementById("micBtn");
  const micStatus = document.getElementById("micStatus");
  const langToggle = document.getElementById("langToggle");

  let currentItem = null;   // {identifier, title, channel, kind, thumbUrl, ...}
  let currentMediaEl = null; // the live <video>/<audio> DOM node, moved between player/mini-player
  let currentKind = "video"; // 'video' | 'audio' | 'text'

  /* ---------- view + request state ---------- */
  let lastListView = "home"; // list the player was opened from (Back button target)
  let feedQuery = "";        // query behind the current feed — reused by "up next"
  let feedItems = [];        // cached so a language switch repaints without refetching
  let upNextItems = [];
  let feedToken = 0;         // out-of-order response guard (rapid chip/search clicks)
  let upNextToken = 0;
  let pdfTimer = 0;
  let micTimer = 0;
  let shareTimer = 0;

  /* ================= WATCH LATER / SAVED (localStorage) ================= */
  const SAVE_KEY = "sh_saved_items";

  function getSaved() {
    try {
      const list = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]");
      return Array.isArray(list) ? list.filter(i => i && typeof i.identifier === "string") : [];
    }
    catch { return []; } // corrupt JSON must not break the whole app
  }
  function setSaved(list) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); return true; }
    catch { return false; } // private mode / quota exceeded — caller reports it
  }
  function isSaved(identifier) { return getSaved().some(i => i.identifier === identifier); }
  function toggleSave(item) {
    const list = getSaved();
    const idx = list.findIndex(i => i.identifier === item.identifier);
    if (idx >= 0) { list.splice(idx, 1); }
    else {
      list.unshift({
        identifier: item.identifier, title: item.title, channel: item.channel,
        avatar: item.avatar || "IA", avatarColor: item.avatarColor || "linear-gradient(135deg,#555,#333)",
        thumbUrl: item.thumbUrl, kind: item.kind || currentKind, views: item.views || "",
        downloads: typeof item.downloads === "number" ? item.downloads : null, time: item.time || "",
      });
    }
    if (!setSaved(list)) { flashSaveStatus(); return; }
    updateSaveButton();
    if (!libraryView.hidden) renderLibrary();
  }
  function updateSaveButton() {
    if (!currentItem) return;
    const saved = isSaved(currentItem.identifier);
    saveBtn.classList.toggle("active", saved);
    saveBtn.setAttribute("aria-pressed", String(saved));
    saveBtn.querySelector("span").textContent = I18N.t(saved ? "saved" : "save");
  }

  /* ================= HTML HELPERS ================= */

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // Gradients we generate ourselves are safe; anything else (e.g. a hand-edited
  // localStorage entry) must not be able to break out of a style="…" attribute.
  function safeCSSColor(value) {
    const s = String(value || "");
    return /^[a-z0-9%,#().\s-]+$/i.test(s) ? s : "linear-gradient(135deg,#555,#333)";
  }

  // archive.org descriptions are user-supplied HTML. Reading them through a
  // detached <div>.innerHTML would let a rogue <img onerror=…> run, so parse
  // with DOMParser instead — it never loads resources or runs scripts.
  function stripHtml(str) {
    const raw = Array.isArray(str) ? str.join(" ") : String(str == null ? "" : str);
    if (typeof DOMParser === "function") {
      const doc = new DOMParser().parseFromString(raw, "text/html");
      return (doc.body && doc.body.textContent) || "";
    }
    return raw.replace(/<[^>]*>/g, " ");
  }

  /* ================= FEED ================= */

  // Counts are formatted per language at render time (not baked into the model),
  // so toggling the language repaints "1.5K" -> "1.5 हज़ार" without a refetch.
  function formatCount(v) {
    if (v && typeof v.downloads === "number") return Archive.formatCount(v.downloads);
    return (v && v.views) || "";
  }

  function cardHTML(v) {
    const badge = v.kind === "audio" ? "♪" : v.kind === "text" ? "📄" : "";
    const color = safeCSSColor(v.avatarColor);
    return `
      <article class="card" data-id="${escapeHTML(v.identifier)}" data-kind="${escapeHTML(v.kind)}">
        <div class="thumb-wrap">
          <img src="${escapeHTML(v.thumbUrl)}" alt="" loading="lazy"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-fallback',style:'background:${color}'}))">
          ${badge ? `<span class="media-badge">${badge}</span>` : ""}
        </div>
        <div class="card-body">
          <span class="avatar" style="background:${color}">${escapeHTML(v.avatar)}</span>
          <div class="card-text">
            <p class="card-title">${escapeHTML(v.title)}</p>
            <div class="card-meta">
              <span>${escapeHTML(v.channel)}</span>
              <span>${escapeHTML(formatCount(v))} <span data-i18n-inline="views">${I18N.t("views")}</span> ${v.time ? "· " + escapeHTML(v.time) : ""}</span>
            </div>
          </div>
        </div>
      </article>`;
  }

  function bindCards(container, items) {
    container.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", () => openMedia(items.find(i => i.identifier === card.dataset.id)));
    });
  }

  function renderFeed() {
    grid.innerHTML = feedItems.map(cardHTML).join("");
    bindCards(grid, feedItems);
  }

  async function loadFeed(query, kind) {
    const token = ++feedToken;
    feedQuery = query;
    feedItems = [];
    feedStatus.hidden = false;
    feedStatus.textContent = I18N.t("loading");
    grid.innerHTML = "";
    try {
      const docs = await Archive.search(query, 16, kind);
      if (token !== feedToken) return; // a newer request already replaced this one
      feedItems = docs.map(Archive.toCardModel);
      if (!feedItems.length) {
        feedStatus.textContent = I18N.t("noResults");
        return;
      }
      renderFeed();
      feedStatus.hidden = true;
    } catch (err) {
      if (token !== feedToken) return;
      feedStatus.textContent = I18N.t("loadFailed");
    }
  }

  async function loadUpNext() {
    const token = ++upNextToken;
    upNextItems = [];
    upNextList.innerHTML = "";
    if (!feedQuery) return;
    try {
      const docs = await Archive.search(feedQuery, 8, currentKind);
      if (token !== upNextToken) return;
      upNextItems = docs
        .map(Archive.toCardModel)
        .filter(i => i.identifier !== (currentItem && currentItem.identifier))
        .slice(0, 6);
      renderUpNext();
    } catch {
      if (token === upNextToken) { upNextItems = []; upNextList.innerHTML = ""; }
    }
  }

  function upCardHTML(v) {
    const color = safeCSSColor(v.avatarColor);
    return `
      <div class="up-card" data-id="${escapeHTML(v.identifier)}">
        <div class="up-thumb"><img src="${escapeHTML(v.thumbUrl)}" alt="" loading="lazy"
             onerror="this.style.background='${color}';this.removeAttribute('src')"></div>
        <div class="up-info">
          <p class="up-title">${escapeHTML(v.title)}</p>
          <span class="up-channel">${escapeHTML(v.channel)}</span>
          <span class="up-meta">${escapeHTML(formatCount(v))} <span data-i18n-inline="views">${I18N.t("views")}</span></span>
        </div>
      </div>`;
  }

  function renderUpNext() {
    upNextList.innerHTML = upNextItems.map(upCardHTML).join("");
    upNextList.querySelectorAll(".up-card").forEach(card => {
      card.addEventListener("click", () => openMedia(upNextItems.find(i => i.identifier === card.dataset.id)));
    });
  }

  /* ================= LIBRARY (SAVED) VIEW ================= */

  function renderLibrary() {
    const items = getSaved();
    if (!items.length) {
      libraryGrid.innerHTML = "";
      libraryEmpty.hidden = false;
      return;
    }
    libraryEmpty.hidden = true;
    libraryGrid.innerHTML = items.map(cardHTML).join("");
    bindCards(libraryGrid, items);
  }

  /* ================= CUSTOM PLAYER (native <video>/<audio>, no third-party embed) ================= */

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    // anything longer than an hour needs h:mm:ss, not "75:23"
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
  }

  function buildMediaEl(kind) {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.className = "media-el";
    el.playsInline = true;
    el.controls = false;
    wireMediaEvents(el);
    return el;
  }

  function wireMediaEvents(el) {
    el.addEventListener("loadedmetadata", () => { durTimeEl.textContent = fmtTime(el.duration); });
    el.addEventListener("timeupdate", () => {
      // live streams report duration Infinity — that must not produce "NaN%"
      const d = el.duration;
      progressFill.style.width = (isFinite(d) && d > 0) ? ((el.currentTime / d) * 100) + "%" : "0%";
      curTimeEl.textContent = fmtTime(el.currentTime);
    });
    el.addEventListener("play", syncPlayIcons);
    el.addEventListener("pause", syncPlayIcons);
    el.addEventListener("waiting", () => { playerLoading.hidden = false; });
    el.addEventListener("playing", () => { playerLoading.hidden = true; });
    el.addEventListener("canplay", () => { playerLoading.hidden = true; customControls.hidden = false; });
    el.addEventListener("error", () => { playerLoading.textContent = I18N.t("loadFailed"); playerLoading.hidden = false; });
  }

  function syncPlayIcons() {
    const playing = !!currentMediaEl && !currentMediaEl.paused;
    playToggle.querySelector(".ic-play").hidden = playing;
    playToggle.querySelector(".ic-pause").hidden = !playing;
    const miniIcon = miniPlayToggle.querySelector("svg");
    miniIcon.innerHTML = playing
      ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  // a fresh media element starts unmuted — the icons must not keep the
  // previous item's muted state
  function syncMuteIcons() {
    const muted = !!currentMediaEl && currentMediaEl.muted;
    muteToggle.querySelector(".ic-vol").hidden = muted;
    muteToggle.querySelector(".ic-mute").hidden = !muted;
  }

  playToggle.addEventListener("click", () => {
    if (!currentMediaEl) return;
    currentMediaEl.paused ? currentMediaEl.play() : currentMediaEl.pause();
  });
  miniPlayToggle.addEventListener("click", e => {
    e.stopPropagation();
    if (!currentMediaEl) return;
    currentMediaEl.paused ? currentMediaEl.play() : currentMediaEl.pause();
  });
  progressTrack.addEventListener("click", e => {
    if (!currentMediaEl || !isFinite(currentMediaEl.duration)) return;
    const rect = progressTrack.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    currentMediaEl.currentTime = pct * currentMediaEl.duration;
  });
  muteToggle.addEventListener("click", () => {
    if (!currentMediaEl) return;
    currentMediaEl.muted = !currentMediaEl.muted;
    syncMuteIcons();
  });
  fullscreenBtn.addEventListener("click", () => {
    if (!currentMediaEl || currentKind !== "video") return;
    if (currentMediaEl.requestFullscreen) currentMediaEl.requestFullscreen();
    else if (currentMediaEl.webkitEnterFullscreen) currentMediaEl.webkitEnterFullscreen();
  });

  /* ================= TABS (up next / comments) ================= */

  function selectTab(name) {
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    const isComments = name === "comments";
    upNextList.hidden = isComments;
    commentsDisabled.hidden = !isComments;
  }

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });

  /* ================= OPEN AN ITEM ================= */

  async function openMedia(quickModel) {
    if (!quickModel) return;

    // remember which list we came from, but only when we're not already
    // inside the player (up-next taps must not change the Back target)
    if (playerView.hidden) lastListView = libraryView.hidden ? "home" : "library";

    // reopening the item that's already loaded (e.g. tapping the mini-player) —
    // just move the live element back into the main player, don't reload it.
    // (PDFs have no persistent element, so this only applies to video/audio.)
    if (currentItem && currentItem.identifier === quickModel.identifier && currentMediaEl) {
      hideMiniPlayer();
      switchToPlayerView();
      player.insertBefore(currentMediaEl, customControls);
      if (currentKind === "audio") { currentMediaEl.hidden = true; audioStage.hidden = false; }
      else { currentMediaEl.hidden = false; audioStage.hidden = true; }
      customControls.hidden = false;
      playerLoading.hidden = true;
      syncPlayIcons();
      return;
    }

    currentItem = quickModel;
    currentKind = quickModel.kind === "audio" ? "audio" : quickModel.kind === "text" ? "text" : "video";

    // reset shell
    pTitle.textContent = quickModel.title;
    pAvatar.style.background = safeCSSColor(quickModel.avatarColor);
    pAvatar.textContent = quickModel.avatar;
    pChannel.textContent = quickModel.channel;
    pMetaLine.textContent = I18N.t("loading");
    pDesc.textContent = "";
    openArchiveLink.href = Archive.detailsUrl(quickModel.identifier);
    ambientGlow.style.backgroundImage = `url(${quickModel.thumbUrl})`;
    downloadPanel.hidden = true;
    downloadBtn.setAttribute("aria-expanded", "false");
    downloadList.innerHTML = "";
    updateSaveButton();

    // reset player shell UI
    clearPdfTimer();
    playerLoading.hidden = false;
    playerLoading.textContent = I18N.t("loading");
    customControls.hidden = true;
    progressFill.style.width = "0%";
    curTimeEl.textContent = "0:00";
    durTimeEl.textContent = "0:00";
    player.classList.remove("doc-mode");
    fullscreenBtn.hidden = currentKind !== "video";
    selectTab("next");

    // detach any previous media element (also sweep any stray leftover nodes)
    if (currentMediaEl) { currentMediaEl.pause(); currentMediaEl.remove(); currentMediaEl = null; }
    player.querySelectorAll("video.media-el, audio.media-el, iframe.pdf-frame").forEach(n => n.remove());
    audioStage.hidden = true;
    pdfFallback.hidden = true;
    syncMuteIcons();

    switchToPlayerView();
    hideMiniPlayer();
    loadUpNext();

    try {
      const meta = await Archive.metadata(quickModel.identifier);
      if (!currentItem || currentItem.identifier !== quickModel.identifier) return; // stale
      const m = meta.metadata || {};
      const kind = Archive.kindOf(m.mediatype);
      currentKind = kind === "text" ? "text" : kind === "audio" ? "audio" : "video";
      fullscreenBtn.hidden = currentKind !== "video";

      pTitle.textContent = m.title || quickModel.title;
      const creator = Array.isArray(m.creator) ? m.creator[0] : (m.creator || quickModel.channel);
      pChannel.textContent = creator;
      miniChannel.textContent = creator;
      pMetaLine.textContent = (m.publicdate ? m.publicdate.slice(0, 10) + " · " : "") + "Internet Archive";
      pDesc.textContent = stripHtml(m.description || I18N.t("noDescription")).slice(0, 500);

      // downloads panel (works the same for video/audio/PDF files)
      const files = Archive.listDownloadFiles(meta.files, quickModel.identifier);
      renderDownloadList(files);

      if (currentKind === "text") {
        openPdfReader(meta.files, quickModel.identifier);
        return;
      }

      // playable video/audio file
      const picked = Archive.pickMediaFile(meta.files, quickModel.identifier, currentKind);
      if (!picked) {
        playerLoading.textContent = I18N.t("loadFailed");
        return;
      }

      const el = buildMediaEl(currentKind);
      el.src = picked.url;
      currentMediaEl = el;
      syncMuteIcons();

      if (currentKind === "audio") {
        audioStage.hidden = false;
        audioArt.style.background = safeCSSColor(quickModel.avatarColor);
        audioArt.textContent = quickModel.avatar;
        el.hidden = true; // no visual track — audioStage supplies the artwork
      } else {
        audioStage.hidden = true;
      }
      player.insertBefore(el, customControls);
      el.autoplay = true;
      el.play().catch(() => {});
    } catch (err) {
      if (!currentItem || currentItem.identifier !== quickModel.identifier) return; // stale
      pMetaLine.textContent = "Internet Archive";
      pDesc.textContent = I18N.t("descFailed");
      playerLoading.textContent = I18N.t("loadFailed");
    }
  }

  /** Render a PDF/document item using the browser's own PDF viewer inside an iframe. */
  function openPdfReader(files, identifier) {
    player.classList.add("doc-mode");
    customControls.hidden = true; // no play/pause/seek for documents
    const pdf = Archive.pickPdfFile(files, identifier);
    if (!pdf) {
      pdfFallback.hidden = false;
      playerLoading.hidden = true;
      return;
    }
    const frame = document.createElement("iframe");
    frame.className = "pdf-frame";
    frame.src = pdf.url;
    frame.title = I18N.t("pdfPreviewTitle");
    frame.addEventListener("load", () => { playerLoading.hidden = true; });
    player.insertBefore(frame, customControls);
    // safety net: some mobile browsers can't render PDFs inline and never fire "load" as expected
    clearPdfTimer();
    pdfTimer = setTimeout(() => { playerLoading.hidden = true; }, 4000);
  }

  function clearPdfTimer() {
    if (pdfTimer) { clearTimeout(pdfTimer); pdfTimer = 0; }
  }

  function renderDownloadList(files) {
    if (!files.length) {
      downloadList.innerHTML = `<p class="feed-status" data-i18n="noDownloads">${I18N.t("noDownloads")}</p>`;
      return;
    }
    downloadList.innerHTML = files.map(f => `
      <a class="download-row" href="${escapeHTML(f.url)}" download target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5zm0-10h4v6h6v-6h4l-7-7z"/></svg>
        <span class="dl-name">${escapeHTML(f.name)}</span>
        <span class="dl-meta">${escapeHTML(f.format)} · ${escapeHTML(f.size)}</span>
      </a>`).join("");
  }

  /* ================= VIEW SWITCHING ================= */

  function setActiveNav(view) {
    bottomNav.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    if (topHomeBtn) topHomeBtn.classList.toggle("active", view === "home");
    if (topLibraryBtn) topLibraryBtn.classList.toggle("active", view === "library");
  }

  function switchToPlayerView() {
    homeView.hidden = true;
    libraryView.hidden = true;
    chips.hidden = true;
    searchBar.hidden = true;
    stopMic();
    playerView.hidden = false;
    backBtn.hidden = false;
    brandLogo.style.display = "none";
    bottomNav.hidden = true;
    window.scrollTo({ top: 0 });
  }

  function showListView(name) {
    playerView.hidden = true;
    homeView.hidden = name !== "home";
    libraryView.hidden = name !== "library";
    chips.hidden = false;
    searchBar.hidden = true;
    stopMic();
    backBtn.hidden = true;
    brandLogo.style.display = "flex";
    bottomNav.hidden = false;
    setActiveNav(name);
    if (name === "library") renderLibrary();
    if (currentMediaEl) showMiniPlayer();
  }

  function goHome() { showListView("home"); }
  function goLibrary() { showListView("library"); }

  backBtn.addEventListener("click", () => showListView(lastListView));
  bottomNav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "home") goHome();
      if (btn.dataset.view === "library") goLibrary();
    });
  });
  // the bottom nav is hidden on wide screens — these top-bar buttons replace it
  if (topHomeBtn) topHomeBtn.addEventListener("click", goHome);
  if (topLibraryBtn) topLibraryBtn.addEventListener("click", goLibrary);

  /* ================= MINI PLAYER (moves the live media element, no reload) ================= */

  function showMiniPlayer() {
    if (!currentMediaEl || !currentItem) return;
    miniVideoSlot.innerHTML = "";
    miniVideoSlot.appendChild(currentMediaEl); // move the live node — keeps it playing, no reload
    if (currentKind === "audio") {
      currentMediaEl.hidden = true; // no visual track — show a color chip instead
      miniVideoSlot.style.background = safeCSSColor(currentItem.avatarColor);
    } else {
      currentMediaEl.hidden = false;
      miniVideoSlot.style.background = "";
    }
    miniTitle.textContent = currentItem.title;
    miniPlayer.hidden = false;
    syncPlayIcons();
  }

  function hideMiniPlayer() {
    miniPlayer.hidden = true;
  }

  miniClose.addEventListener("click", e => {
    e.stopPropagation();
    if (currentMediaEl) { currentMediaEl.pause(); currentMediaEl.remove(); currentMediaEl = null; }
    hideMiniPlayer();
  });

  miniPlayer.addEventListener("click", e => {
    if (e.target.closest("#miniClose") || e.target.closest("#miniPlayToggle")) return;
    if (currentItem) openMedia(currentItem);
  });

  /* ================= SAVE / SHARE / DOWNLOAD BUTTONS ================= */

  saveBtn.addEventListener("click", () => {
    if (currentItem) toggleSave(currentItem);
  });

  downloadBtn.addEventListener("click", () => {
    downloadPanel.hidden = !downloadPanel.hidden;
    downloadBtn.setAttribute("aria-expanded", String(!downloadPanel.hidden));
  });

  shareBtn.addEventListener("click", async () => {
    if (!currentItem) return;
    const url = Archive.detailsUrl(currentItem.identifier);
    try {
      if (navigator.share) await navigator.share({ title: currentItem.title, url });
      else { await navigator.clipboard.writeText(url); flashShareStatus(); }
    } catch { /* user cancelled share sheet — ignore */ }
  });
  function flashShareStatus() {
    const span = shareBtn.querySelector("span");
    span.textContent = I18N.t("linkCopied");
    if (shareTimer) clearTimeout(shareTimer);
    shareTimer = setTimeout(() => { span.textContent = I18N.t("share"); shareTimer = 0; }, 1500);
  }
  function flashSaveStatus() {
    const span = saveBtn.querySelector("span");
    span.textContent = I18N.t("saveFailed");
    setTimeout(() => { updateSaveButton(); }, 1500);
  }

  /* ================= FILTER CHIPS ================= */

  chips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      loadFeed(chip.dataset.query, chip.dataset.kind);
    });
  });

  /* ================= SEARCH BAR + MIC ================= */

  searchBtn.addEventListener("click", () => {
    searchBar.hidden = false;
    chips.hidden = true;
    searchInput.focus();
  });
  searchClose.addEventListener("click", () => {
    stopMic();
    searchBar.hidden = true;
    chips.hidden = !playerView.hidden; // stay hidden while the player is on screen
    searchInput.value = "";
  });

  // archive.org search is Lucene: parentheses, quotes, colons and boolean
  // keywords in user input change (or break) the query, so keep letters,
  // numbers, spaces and apostrophes only.
  function sanitizeSearchTerm(text) {
    return String(text || "")
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .replace(/\b(AND|OR|NOT|TO)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function runSearch(text) {
    const term = sanitizeSearchTerm(text);
    searchBar.hidden = true;
    // searching always brings you back to the home feed — results must not load
    // into a hidden grid while a player (or the library) is on screen
    showListView("home");
    if (!term) {
      feedToken++; // cancel anything in flight
      feedItems = [];
      grid.innerHTML = "";
      feedStatus.hidden = false;
      feedStatus.textContent = I18N.t("emptySearch");
      return;
    }
    const chip = chips.querySelector(".chip.active") || chips.querySelector(".chip");
    const kind = (chip && chip.dataset.kind) || "video";
    loadFeed(`title:(${term}) OR subject:(${term}) OR description:(${term})`, kind);
  }
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") runSearch(searchInput.value);
  });

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;

  function showMicStatus(message) {
    micStatus.hidden = false;
    micStatus.textContent = message;
    if (micTimer) clearTimeout(micTimer);
    micTimer = setTimeout(() => { micStatus.hidden = true; micTimer = 0; }, 3000);
  }
  function stopMic() {
    if (micTimer) { clearTimeout(micTimer); micTimer = 0; }
    micStatus.hidden = true;
    micBtn.classList.remove("active");
    if (recognizer) {
      const r = recognizer;
      recognizer = null;
      try { r.stop(); } catch { /* already stopped */ }
    }
  }

  micBtn.addEventListener("click", () => {
    if (!SpeechRecognitionCtor) { showMicStatus(I18N.t("micUnsupported")); return; }
    if (recognizer) { stopMic(); return; }
    try {
      recognizer = new SpeechRecognitionCtor();
      recognizer.lang = I18N.localeTag();
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
      micBtn.classList.add("active");
      micStatus.hidden = false;
      micStatus.textContent = I18N.t("listening");

      recognizer.onresult = e => {
        const text = e.results[0][0].transcript;
        searchInput.value = text;
        runSearch(text);
      };
      recognizer.onerror = () => { showMicStatus(I18N.t("micError")); };
      recognizer.onend = () => { micBtn.classList.remove("active"); micStatus.hidden = true; recognizer = null; };
      recognizer.start(); // may throw when permission is denied
    } catch {
      recognizer = null;
      micBtn.classList.remove("active");
      showMicStatus(I18N.t("micError"));
    }
  });

  /* ================= LANGUAGE TOGGLE ================= */
  langToggle.addEventListener("click", () => I18N.toggle());
  document.addEventListener("i18n:changed", () => {
    if (currentItem) updateSaveButton();
    // counts ("2.5 लाख" / "250K") are baked into the rendered cards, so repaint
    // the lists from cache instead of leaving the old language on screen
    if (!homeView.hidden && feedItems.length) renderFeed();
    if (!libraryView.hidden) renderLibrary();
    if (!playerView.hidden && upNextItems.length) renderUpNext();
  });

  /* ================= INIT ================= */
  I18N.apply();
  const defaultChip = chips.querySelector(".chip.active") || chips.querySelector(".chip");
  setActiveNav("home");
  loadFeed(defaultChip.dataset.query, defaultChip.dataset.kind);
})();

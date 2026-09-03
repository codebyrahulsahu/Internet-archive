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
  let currentKind = "video"; // 'video' | 'audio'

  /* ================= WATCH LATER / SAVED (localStorage) ================= */
  const SAVE_KEY = "sh_saved_items";

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); }
    catch { return []; }
  }
  function setSaved(list) { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); }
  function isSaved(identifier) { return getSaved().some(i => i.identifier === identifier); }
  function toggleSave(item) {
    const list = getSaved();
    const idx = list.findIndex(i => i.identifier === item.identifier);
    if (idx >= 0) { list.splice(idx, 1); }
    else {
      list.unshift({
        identifier: item.identifier, title: item.title, channel: item.channel,
        avatar: item.avatar || "IA", avatarColor: item.avatarColor || "linear-gradient(135deg,#555,#333)",
        thumbUrl: item.thumbUrl, kind: item.kind || currentKind, views: item.views || "", time: item.time || "",
      });
    }
    setSaved(list);
    updateSaveButton();
  }
  function updateSaveButton() {
    if (!currentItem) return;
    saveBtn.classList.toggle("active", isSaved(currentItem.identifier));
    saveBtn.querySelector("span").textContent = I18N.t(isSaved(currentItem.identifier) ? "saved" : "save");
  }

  /* ================= FEED ================= */

  function cardHTML(v) {
    const badge = v.kind === "audio" ? "♪" : v.kind === "text" ? "📄" : "";
    return `
      <article class="card" data-id="${v.identifier}" data-kind="${v.kind}">
        <div class="thumb-wrap">
          <img src="${v.thumbUrl}" alt="" loading="lazy"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-fallback',style:'background:${v.avatarColor}'}))">
          ${badge ? `<span class="media-badge">${badge}</span>` : ""}
        </div>
        <div class="card-body">
          <span class="avatar" style="background:${v.avatarColor}">${v.avatar}</span>
          <div class="card-text">
            <p class="card-title">${escapeHTML(v.title)}</p>
            <div class="card-meta">
              <span>${escapeHTML(v.channel)}</span>
              <span>${v.views} <span data-i18n-inline="views">${I18N.t("views")}</span> ${v.time ? "· " + v.time : ""}</span>
            </div>
          </div>
        </div>
      </article>`;
  }

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  async function loadFeed(query, kind) {
    feedStatus.hidden = false;
    feedStatus.textContent = I18N.t("loading");
    grid.innerHTML = "";
    try {
      const docs = await Archive.search(query, 16, kind);
      if (!docs.length) {
        feedStatus.textContent = I18N.t("noResults");
        return;
      }
      const items = docs.map(Archive.toCardModel);
      grid.innerHTML = items.map(cardHTML).join("");
      grid.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => openMedia(items.find(i => i.identifier === card.dataset.id)));
      });
      feedStatus.hidden = true;
    } catch (err) {
      feedStatus.textContent = I18N.t("loadFailed");
    }
  }

  async function loadUpNext(relatedQuery, kind) {
    upNextList.innerHTML = "";
    try {
      const query = relatedQuery || (chips.querySelector(".chip.active") || chips.querySelector(".chip")).dataset.query;
      const useKind = kind || currentKind;
      const docs = await Archive.search(query, 8, useKind);
      const items = docs.map(Archive.toCardModel).filter(i => i.identifier !== (currentItem && currentItem.identifier));
      upNextList.innerHTML = items.slice(0, 6).map(upCardHTML).join("");
      upNextList.querySelectorAll(".up-card").forEach(card => {
        card.addEventListener("click", () => openMedia(items.find(i => i.identifier === card.dataset.id)));
      });
    } catch {
      upNextList.innerHTML = "";
    }
  }

  function upCardHTML(v) {
    return `
      <div class="up-card" data-id="${v.identifier}">
        <div class="up-thumb"><img src="${v.thumbUrl}" alt="" loading="lazy"
             onerror="this.style.background='${v.avatarColor}';this.removeAttribute('src')"></div>
        <div class="up-info">
          <p class="up-title">${escapeHTML(v.title)}</p>
          <span class="up-channel">${escapeHTML(v.channel)}</span>
          <span class="up-meta">${v.views} ${I18N.t("views")}</span>
        </div>
      </div>`;
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
    libraryGrid.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", () => openMedia(items.find(i => i.identifier === card.dataset.id)));
    });
  }

  /* ================= CUSTOM PLAYER (native <video>/<audio>, no third-party embed) ================= */

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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
      if (el.duration) progressFill.style.width = (el.currentTime / el.duration) * 100 + "%";
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
    const playing = currentMediaEl && !currentMediaEl.paused;
    playToggle.querySelector(".ic-play").hidden = playing;
    playToggle.querySelector(".ic-pause").hidden = !playing;
    const miniIcon = miniPlayToggle.querySelector("svg");
    miniIcon.innerHTML = playing
      ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
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
    if (!currentMediaEl || !currentMediaEl.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    currentMediaEl.currentTime = pct * currentMediaEl.duration;
  });
  muteToggle.addEventListener("click", () => {
    if (!currentMediaEl) return;
    currentMediaEl.muted = !currentMediaEl.muted;
    muteToggle.querySelector(".ic-vol").hidden = currentMediaEl.muted;
    muteToggle.querySelector(".ic-mute").hidden = !currentMediaEl.muted;
  });
  fullscreenBtn.addEventListener("click", () => {
    if (currentKind === "audio") return;
    if (currentMediaEl.requestFullscreen) currentMediaEl.requestFullscreen();
    else if (currentMediaEl.webkitEnterFullscreen) currentMediaEl.webkitEnterFullscreen();
  });

  async function openMedia(quickModel) {
    if (!quickModel) return;

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
      loadUpNext(null, currentKind);
      return;
    }

    currentItem = quickModel;
    currentKind = quickModel.kind === "audio" ? "audio" : quickModel.kind === "text" ? "text" : "video";

    // reset shell
    pTitle.textContent = quickModel.title;
    pAvatar.style.background = quickModel.avatarColor;
    pAvatar.textContent = quickModel.avatar;
    pChannel.textContent = quickModel.channel;
    pMetaLine.textContent = I18N.t("loading");
    pDesc.textContent = "";
    openArchiveLink.href = Archive.detailsUrl(quickModel.identifier);
    ambientGlow.style.backgroundImage = `url(${quickModel.thumbUrl})`;
    downloadPanel.hidden = true;
    downloadList.innerHTML = "";
    updateSaveButton();

    // reset player shell UI
    playerLoading.hidden = false;
    playerLoading.textContent = I18N.t("loading");
    customControls.hidden = true;
    progressFill.style.width = "0%";
    curTimeEl.textContent = "0:00";
    durTimeEl.textContent = "0:00";
    player.classList.remove("doc-mode");

    // detach any previous media element (also sweep any stray leftover nodes)
    if (currentMediaEl) { currentMediaEl.pause(); currentMediaEl.remove(); currentMediaEl = null; }
    player.querySelectorAll("video.media-el, audio.media-el, iframe.pdf-frame").forEach(n => n.remove());
    audioStage.hidden = true;
    pdfFallback.hidden = true;

    switchToPlayerView();
    hideMiniPlayer();
    loadUpNext(null, currentKind);

    try {
      const meta = await Archive.metadata(quickModel.identifier);
      const m = meta.metadata || {};
      const kind = Archive.kindOf(m.mediatype);
      currentKind = kind === "text" ? "text" : kind === "audio" ? "audio" : "video";

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

      if (currentKind === "audio") {
        audioStage.hidden = false;
        audioArt.style.background = quickModel.avatarColor;
        audioArt.textContent = quickModel.avatar;
        el.hidden = true; // no visual track — audioStage supplies the artwork
      } else {
        audioStage.hidden = true;
      }
      player.insertBefore(el, customControls);
      el.autoplay = true;
      el.play().catch(() => {});
    } catch (err) {
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
    frame.title = "PDF preview";
    frame.addEventListener("load", () => { playerLoading.hidden = true; });
    player.insertBefore(frame, customControls);
    // safety net: some mobile browsers can't render PDFs inline and never fire "load" as expected
    setTimeout(() => { playerLoading.hidden = true; }, 4000);
  }

  function renderDownloadList(files) {
    if (!files.length) {
      downloadList.innerHTML = `<p class="feed-status" data-i18n="noDownloads">${I18N.t("noDownloads")}</p>`;
      return;
    }
    downloadList.innerHTML = files.map(f => `
      <a class="download-row" href="${f.url}" download target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5zm0-10h4v6h6v-6h4l-7-7z"/></svg>
        <span class="dl-name">${escapeHTML(f.name)}</span>
        <span class="dl-meta">${f.format} · ${f.size}</span>
      </a>`).join("");
  }

  function stripHtml(str) {
    const div = document.createElement("div");
    div.innerHTML = Array.isArray(str) ? str.join(" ") : str;
    return div.textContent || div.innerText || "";
  }

  function switchToPlayerView() {
    homeView.hidden = true;
    libraryView.hidden = true;
    chips.hidden = true;
    searchBar.hidden = true;
    playerView.hidden = false;
    backBtn.hidden = false;
    brandLogo.style.display = "none";
    bottomNav.hidden = true;
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    playerView.hidden = true;
    libraryView.hidden = true;
    homeView.hidden = false;
    chips.hidden = false;
    backBtn.hidden = true;
    brandLogo.style.display = "flex";
    bottomNav.hidden = false;
    if (currentMediaEl) showMiniPlayer();
  }

  function goLibrary() {
    playerView.hidden = true;
    homeView.hidden = true;
    chips.hidden = true;
    libraryView.hidden = false;
    backBtn.hidden = true;
    brandLogo.style.display = "flex";
    bottomNav.hidden = false;
    renderLibrary();
    if (currentMediaEl) showMiniPlayer();
  }

  backBtn.addEventListener("click", goHome);
  bottomNav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      bottomNav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.view === "home") goHome();
      if (btn.dataset.view === "library") goLibrary();
    });
  });

  /* ================= MINI PLAYER (moves the live media element, no reload) ================= */

  function showMiniPlayer() {
    if (!currentMediaEl) return;
    miniVideoSlot.innerHTML = "";
    miniVideoSlot.appendChild(currentMediaEl); // move the live node — keeps it playing, no reload
    if (currentKind === "audio") {
      currentMediaEl.hidden = true; // no visual track — show a color chip instead
      miniVideoSlot.style.background = currentItem.avatarColor;
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
    setTimeout(() => { span.textContent = I18N.t("share"); }, 1500);
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
    searchBar.hidden = true;
    chips.hidden = false;
    searchInput.value = "";
  });
  function runSearch(text) {
    if (!text.trim()) return;
    chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    loadFeed(`title:(${text}) OR subject:(${text}) OR description:(${text})`, "video");
    searchBar.hidden = true;
    chips.hidden = false;
  }
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") runSearch(searchInput.value);
  });

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  micBtn.addEventListener("click", () => {
    if (!SpeechRecognitionCtor) {
      micStatus.hidden = false;
      micStatus.textContent = I18N.t("micUnsupported");
      setTimeout(() => { micStatus.hidden = true; }, 3000);
      return;
    }
    if (recognizer) { recognizer.stop(); return; }
    recognizer = new SpeechRecognitionCtor();
    recognizer.lang = I18N.lang() === "hi" ? "hi-IN" : "en-US";
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
    recognizer.onerror = () => { micStatus.hidden = true; };
    recognizer.onend = () => { micBtn.classList.remove("active"); micStatus.hidden = true; recognizer = null; };
    recognizer.start();
  });

  /* ================= LANGUAGE TOGGLE ================= */
  langToggle.addEventListener("click", () => I18N.toggle());
  document.addEventListener("i18n:changed", () => {
    if (currentItem) updateSaveButton();
    if (!homeView.hidden) { /* re-render feed text bits handled by data-i18n already */ }
    if (!libraryView.hidden) renderLibrary();
  });

  /* ================= TABS ================= */
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isComments = tab.dataset.tab === "comments";
      upNextList.hidden = isComments;
      commentsDisabled.hidden = !isComments;
    });
  });

  /* ================= INIT ================= */
  I18N.apply();
  const defaultChip = chips.querySelector(".chip.active");
  loadFeed(defaultChip.dataset.query, defaultChip.dataset.kind);
})();

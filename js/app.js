(function () {
  "use strict";

  /* ---------- element refs ---------- */
  const grid = document.getElementById("videoGrid");
  const feedStatus = document.getElementById("feedStatus");
  const homeView = document.getElementById("homeView");
  const playerView = document.getElementById("playerView");
  const libraryView = document.getElementById("libraryView");
  const placeholderView = document.getElementById("placeholderView");
  const placeholderTitle = document.getElementById("placeholderTitle");
  const historyGrid = document.getElementById("historyGrid");
  const historyEmpty = document.getElementById("historyEmpty");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const upNextList = document.getElementById("upNext");
  const itemInfo = document.getElementById("itemInfo");
  const backBtn = document.getElementById("backBtn");
  const brandLogo = document.getElementById("brandLogo");
  const chips = document.getElementById("chips");
  const bottomNav = document.getElementById("bottomNav");
  const miniPlayer = document.getElementById("miniPlayer");
  const miniVideoSlot = document.getElementById("miniVideoSlot");
  const miniTitle = document.getElementById("miniTitle");
  const miniChannel = document.getElementById("miniChannel");
  const miniClose = document.getElementById("miniClose");
  const ambientGlow = document.getElementById("ambientGlow");
  const player = document.getElementById("player");
  const pTitle = document.getElementById("pTitle");
  const pMetaLine = document.getElementById("pMetaLine");
  const pDesc = document.getElementById("pDesc");
  const openArchiveLink = document.getElementById("openArchiveLink");
  const searchBtn = document.getElementById("searchBtn");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");
  const searchClose = document.getElementById("searchClose");
  const notifBtn = document.getElementById("notifBtn");
  const toastEl = document.getElementById("toast");
  const likeBtn = document.getElementById("likeBtn");
  const likeCount = document.getElementById("likeCount");
  const dislikeBtn = document.getElementById("dislikeBtn");
  const shareBtn = document.getElementById("shareBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clipBtn = document.getElementById("clipBtn");
  const saveBtn = document.getElementById("saveBtn");
  const subscribeBtn = document.getElementById("subscribeBtn");
  const pChannelName = document.getElementById("pChannelName");
  const pChannelSubs = document.getElementById("pChannelSubs");
  const pChannelAvatar = document.getElementById("pChannelAvatar");

  const HISTORY_KEY = "streamhub:history";
  const SUBS_KEY = "streamhub:subs";
  const HISTORY_LIMIT = 24;

  let currentItem = null;
  let currentIframe = null; // the live <iframe> DOM node, moved between player/mini-player
  let pendingModel = null;  // card model passed along with a navigate() to show title instantly
  let toastTimer = null;

  const DEFAULT_QUERY = chips.querySelector(".chip.active").dataset.query;

  const PLACEHOLDER_TITLES = {
    shorts: "शॉर्ट्स",
    create: "क्रिएट",
    subs: "सब्स्क्रिप्शन"
  };

  /* ================= small helpers ================= */

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function stripHtml(str) {
    const div = document.createElement("div");
    div.innerHTML = Array.isArray(str) ? str.join(" ") : str;
    return div.textContent || div.innerText || "";
  }

  /** localStorage can throw (private mode / file://) — never let that break the app */
  function store(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage unavailable — features silently degrade */
    }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  /* ================= NAVIGATION (History API integration) ================= */

  function navigate(view, param) {
    history.pushState({ view, param }, "");
    render(view, param);
  }

  function render(view, param) {
    switch (view) {
      case "library":
        showLibrary();
        break;
      case "placeholder":
        showPlaceholder(param);
        break;
      case "player":
        openVideo(param);
        break;
      default:
        showHome();
    }
  }

  /** open a video from anywhere (cards, up-next, mini player) */
  function playVideo(model) {
    if (!model || !model.identifier) return;
    pendingModel = model;
    navigate("player", model.identifier);
  }

  window.addEventListener("popstate", e => {
    const state = e.state || { view: "home" };
    render(state.view, state.param);
  });

  function setActiveNav(view) {
    bottomNav.querySelectorAll(".nav-item").forEach(b => {
      b.classList.toggle("active", b.dataset.view === view);
    });
  }

  function setTopbar(inSubView) {
    backBtn.hidden = !inSubView;
    brandLogo.style.display = inSubView ? "none" : "flex";
  }

  function hideAllViews() {
    homeView.hidden = true;
    playerView.hidden = true;
    libraryView.hidden = true;
    placeholderView.hidden = true;
  }

  function showHome() {
    hideAllViews();
    homeView.hidden = false;
    chips.hidden = false;
    searchBar.hidden = true;
    bottomNav.hidden = false;
    setTopbar(false);
    setActiveNav("home");
    updateMiniPlayer();
  }

  function showLibrary() {
    hideAllViews();
    libraryView.hidden = false;
    chips.hidden = true;
    searchBar.hidden = true;
    bottomNav.hidden = false;
    setTopbar(true);
    setActiveNav("library");
    renderHistory();
    updateMiniPlayer();
  }

  function showPlaceholder(kind) {
    hideAllViews();
    placeholderView.hidden = false;
    placeholderTitle.textContent = PLACEHOLDER_TITLES[kind] || "जल्द आ रहा है";
    chips.hidden = true;
    searchBar.hidden = true;
    bottomNav.hidden = false;
    setTopbar(true);
    setActiveNav(kind);
    updateMiniPlayer();
  }

  function switchToPlayerView() {
    hideAllViews();
    playerView.hidden = false;
    chips.hidden = true;
    searchBar.hidden = true;
    bottomNav.hidden = true;
    setTopbar(true);
    window.scrollTo({ top: 0 });
    updateMiniPlayer();
  }

  backBtn.addEventListener("click", () => history.back());

  brandLogo.addEventListener("click", () => navigate("home"));

  bottomNav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "home") navigate("home");
      else if (view === "library") navigate("library");
      else navigate("placeholder", view);
    });
  });

  /* ================= FEED ================= */

  function cardHTML(v) {
    return `
      <article class="card" data-id="${escapeHTML(v.identifier)}" role="button" tabindex="0" aria-label="${escapeHTML(v.title)}">
        <div class="thumb-wrap">
          <img src="${v.thumbUrl}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="card-body">
          <span class="avatar" style="background:${v.avatarColor}">${escapeHTML(v.avatar)}</span>
          <div class="card-text">
            <p class="card-title">${escapeHTML(v.title)}</p>
            <div class="card-meta">
              <span>${escapeHTML(v.channel)}</span>
              <span>${v.views} डाउनलोड्स ${v.time ? "· " + v.time : ""}</span>
            </div>
          </div>
        </div>
      </article>`;
  }

  /** attach click + keyboard activation + thumbnail fallback to rendered cards */
  function bindCards(container, items) {
    container.querySelectorAll(".card").forEach(card => {
      const model = items.find(i => i.identifier === card.dataset.id);
      const activate = () => {
        if (model) playVideo(model);
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
      const img = card.querySelector(".thumb-wrap img");
      if (img) {
        img.addEventListener("error", () => {
          const fallback = document.createElement("div");
          fallback.className = "thumb-fallback";
          fallback.style.background = model ? model.avatarColor : "#212121";
          img.replaceWith(fallback);
        });
      }
    });
  }

  async function loadFeed(query) {
    feedStatus.hidden = false;
    feedStatus.textContent = "लोड हो रहा है…";
    grid.innerHTML = "";
    try {
      const docs = await Archive.search(query, 16);
      if (!docs.length) {
        feedStatus.textContent = "कोई नतीजा नहीं मिला।";
        return;
      }
      const items = docs.map(Archive.toCardModel);
      grid.innerHTML = items.map(cardHTML).join("");
      bindCards(grid, items);
      feedStatus.hidden = true;
    } catch (err) {
      feedStatus.textContent = "archive.org से लोड नहीं हो सका — इंटरनेट कनेक्शन चेक करें। (" + err.message + ")";
    }
  }

  async function loadUpNext(subject) {
    upNextList.innerHTML = `<p class="feed-status">सुझाव लोड हो रहे हैं…</p>`;
    const mediatype = (currentItem && currentItem.mediatype) || "movies";
    const query = subject
      ? `mediatype:(${mediatype}) AND subject:("${subject.replace(/"/g, "")}")`
      : DEFAULT_QUERY;
    try {
      let docs = await Archive.search(query, 8);
      if (!docs.length && subject) docs = await Archive.search(DEFAULT_QUERY, 8);
      const items = docs
        .map(Archive.toCardModel)
        .filter(i => i.identifier !== (currentItem && currentItem.identifier));
      upNextList.innerHTML = items.slice(0, 6).map(upCardHTML).join("");
      upNextList.querySelectorAll(".up-card").forEach(card => {
        card.addEventListener("click", () => {
          const model = items.find(i => i.identifier === card.dataset.id);
          if (model) playVideo(model);
        });
      });
    } catch (err) {
      upNextList.innerHTML = `<p class="feed-status">सुझाव लोड नहीं हो सके।</p>`;
    }
  }

  function upCardHTML(v) {
    return `
      <div class="up-card" data-id="${escapeHTML(v.identifier)}" role="button" tabindex="0" aria-label="${escapeHTML(v.title)}">
        <div class="up-thumb"><img src="${v.thumbUrl}" alt="" loading="lazy" decoding="async"></div>
        <div class="up-info">
          <p class="up-title">${escapeHTML(v.title)}</p>
          <span class="up-channel">${escapeHTML(v.channel)}</span>
          <span class="up-meta">${v.views} डाउनलोड्स</span>
        </div>
      </div>`;
  }

  /* ================= WATCH HISTORY (Library) ================= */

  function pushHistory(item) {
    if (!item || !item.identifier) return;
    const list = store(HISTORY_KEY, []).filter(i => i.identifier !== item.identifier);
    list.unshift({
      identifier: item.identifier,
      title: item.title,
      channel: item.channel,
      avatar: item.avatar,
      avatarColor: item.avatarColor,
      views: item.views,
      time: item.time,
      mediatype: item.mediatype,
      thumbUrl: item.thumbUrl
    });
    save(HISTORY_KEY, list.slice(0, HISTORY_LIMIT));
  }

  function historyLookup(identifier) {
    return store(HISTORY_KEY, []).find(i => i.identifier === identifier) || null;
  }

  function renderHistory() {
    const list = store(HISTORY_KEY, []);
    historyEmpty.hidden = list.length > 0;
    clearHistoryBtn.hidden = list.length === 0;
    historyGrid.innerHTML = list.map(cardHTML).join("");
    bindCards(historyGrid, list);
  }

  clearHistoryBtn.addEventListener("click", () => {
    save(HISTORY_KEY, []);
    renderHistory();
    toast("देखने का इतिहास साफ़ कर दिया गया");
  });

  /* ================= PLAYER ================= */

  function buildIframe(identifier) {
    const iframe = document.createElement("iframe");
    iframe.src = Archive.embedUrl(identifier);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.className = "archive-iframe";
    iframe.title = "archive.org player";
    return iframe;
  }

  function firstSubject(meta) {
    const m = meta.metadata || {};
    if (!m.subject) return null;
    const subject = Array.isArray(m.subject) ? m.subject[0] : String(m.subject).split(";")[0];
    return subject ? subject.trim() : null;
  }

  function renderItemInfo(meta) {
    const m = meta.metadata || {};
    const creator = Array.isArray(m.creator) ? m.creator.join(", ") : (m.creator || "Internet Archive");
    const date = (m.addeddate || m.publicdate || "").slice(0, 10);
    const subjects = Array.isArray(m.subject) ? m.subject.join(" · ")
      : (m.subject ? String(m.subject).split(";").map(s => s.trim()).join(" · ") : "—");
    const rows = [
      ["निर्माता", creator],
      ["मीडिया प्रकार", m.mediatype || "—"],
      ["जोड़े गए दिन", date || "—"],
      ["विषय", subjects],
      ["फ़ाइलें", meta.files ? meta.files.length + " फ़ाइलें" : "—"],
      ["आइटम ID", m.identifier || "—"]
    ];
    itemInfo.innerHTML = `
      <dl class="info-list">
        ${rows.map(([k, v]) => `
          <div class="info-row">
            <dt class="info-key">${k}</dt>
            <dd class="info-val">${escapeHTML(v)}</dd>
          </div>`).join("")}
      </dl>`;
  }

  function updateSubscribeUI() {
    const subs = new Set(store(SUBS_KEY, []));
    const subscribed = currentItem && subs.has(currentItem.channel);
    subscribeBtn.classList.toggle("subscribed", Boolean(subscribed));
    subscribeBtn.textContent = subscribed ? "सब्सक्राइब्ड ✓" : "सब्सक्राइब करें";
  }

  async function openVideo(identifier) {
    currentItem = pendingModel || historyLookup(identifier) ||
      { identifier, title: identifier, channel: "Internet Archive", mediatype: "movies", avatar: "IA", avatarColor: "linear-gradient(135deg,#3ddad7,#3d7bfd)" };
    pendingModel = null;

    // reset player shell
    pTitle.textContent = currentItem.title;
    pMetaLine.textContent = "लोड हो रहा है…";
    pDesc.textContent = "";
    pChannelName.textContent = currentItem.channel || "Internet Archive";
    pChannelSubs.textContent = "Internet Archive · archive.org";
    pChannelAvatar.textContent = currentItem.avatar || "IA";
    if (currentItem.avatarColor) pChannelAvatar.style.background = currentItem.avatarColor;
    likeBtn.classList.remove("active");
    dislikeBtn.classList.remove("active");
    likeCount.textContent = currentItem.views ? currentItem.views + " डाउनलोड्स" : "—";
    openArchiveLink.href = Archive.detailsUrl(identifier);
    ambientGlow.style.backgroundImage = `url(${Archive.thumbUrl(identifier)})`;
    setTab("next");
    updateSubscribeUI();

    if (!currentIframe || currentIframe.dataset.id !== identifier) {
      if (currentIframe) currentIframe.remove();
      currentIframe = buildIframe(identifier);
      currentIframe.dataset.id = identifier;
    }
    player.innerHTML = "";
    player.appendChild(currentIframe);
    switchToPlayerView();

    pushHistory(currentItem);

    try {
      const meta = await Archive.metadata(identifier);
      const m = meta.metadata || {};
      pTitle.textContent = m.title || currentItem.title;
      const creator = Array.isArray(m.creator) ? m.creator[0] : (m.creator || currentItem.channel);
      miniChannel.textContent = creator;
      pChannelName.textContent = creator || "Internet Archive";
      pMetaLine.textContent = (m.publicdate ? m.publicdate.slice(0, 10) + " · " : "") + "Internet Archive";
      pDesc.textContent = stripHtml(m.description || "इस आइटम के लिए कोई विवरण उपलब्ध नहीं है।").slice(0, 400);
      renderItemInfo(meta);
      // refresh history entry with the authoritative title
      pushHistory(Object.assign({}, currentItem, { title: pTitle.textContent, channel: creator }));
      loadUpNext(firstSubject(meta));
    } catch (err) {
      pMetaLine.textContent = "Internet Archive";
      pDesc.textContent = "विवरण लोड नहीं हो सका।";
      itemInfo.innerHTML = `<p class="feed-status">आइटम की जानकारी लोड नहीं हो सकी।</p>`;
      loadUpNext(null);
    }
  }

  /* ================= MINI PLAYER (moves the live iframe, no reload) ================= */

  function updateMiniPlayer() {
    if (currentIframe && playerView.hidden) showMiniPlayer();
    else hideMiniPlayer();
  }

  function showMiniPlayer() {
    if (!currentIframe) return;
    if (currentIframe.parentElement !== miniVideoSlot) {
      miniVideoSlot.innerHTML = "";
      miniVideoSlot.appendChild(currentIframe);
    }
    miniTitle.textContent = currentItem ? currentItem.title : "";
    miniPlayer.hidden = false;
  }

  function hideMiniPlayer() {
    miniPlayer.hidden = true;
  }

  miniClose.addEventListener("click", e => {
    e.stopPropagation();
    if (currentIframe) { currentIframe.remove(); currentIframe = null; }
    hideMiniPlayer();
  });

  miniPlayer.addEventListener("click", e => {
    if (e.target.closest("#miniClose")) return;
    if (currentItem) playVideo(currentItem);
  });

  /* ================= FILTER CHIPS ================= */

  chips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      loadFeed(chip.dataset.query);
    });
  });

  /* ================= SEARCH ================= */

  // archive.org की query syntax तोड़ने वाले characters हटा दें
  function sanitizeQuery(q) {
    return q.replace(/[():"\\]/g, " ").replace(/\s+/g, " ").trim();
  }

  function closeSearch() {
    searchBar.hidden = true;
    if (!homeView.hidden) chips.hidden = false;
    searchInput.value = "";
  }

  searchBtn.addEventListener("click", () => {
    if (searchBar.hidden) {
      searchBar.hidden = false;
      chips.hidden = true;
      searchInput.focus();
    } else {
      closeSearch();
    }
  });

  searchClose.addEventListener("click", closeSearch);

  searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSearch();
    } else if (e.key === "Enter") {
      const q = sanitizeQuery(searchInput.value);
      if (q) {
        chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        loadFeed(`title:(${q}) OR subject:(${q}) OR creator:(${q})`);
        closeSearch();
      }
    }
  });

  /* ================= PLAYER ACTION BUTTONS ================= */

  subscribeBtn.addEventListener("click", () => {
    if (!currentItem) return;
    const channel = currentItem.channel || "Internet Archive";
    const subs = new Set(store(SUBS_KEY, []));
    if (subs.has(channel)) {
      subs.delete(channel);
      toast("सब्सक्रिप्शन हटाया गया");
    } else {
      subs.add(channel);
      toast("सब्सक्राइब किया गया (डेमो)");
    }
    save(SUBS_KEY, Array.from(subs));
    updateSubscribeUI();
  });

  likeBtn.addEventListener("click", () => {
    dislikeBtn.classList.remove("active");
    likeBtn.classList.toggle("active");
  });

  dislikeBtn.addEventListener("click", () => {
    likeBtn.classList.remove("active");
    dislikeBtn.classList.toggle("active");
  });

  shareBtn.addEventListener("click", async () => {
    if (!currentItem) return;
    const url = Archive.detailsUrl(currentItem.identifier);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast("archive.org का लिंक कॉपी हो गया");
        return;
      } catch (err) {
        /* clipboard blocked — fall through to opening the page */
      }
    }
    window.open(url, "_blank", "noopener");
  });

  downloadBtn.addEventListener("click", () => {
    if (!currentItem) return;
    window.open(Archive.downloadUrl(currentItem.identifier), "_blank", "noopener");
  });

  clipBtn.addEventListener("click", () => toast("क्लिप बनाना जल्द आ रहा है"));
  saveBtn.addEventListener("click", () => toast("सेव करना जल्द आ रहा है"));
  notifBtn.addEventListener("click", () => toast("कोई नई सूचना नहीं है"));

  /* ================= TABS ================= */

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    upNextList.hidden = name !== "next";
    itemInfo.hidden = name !== "info";
  }

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  /* ================= INIT ================= */

  history.replaceState({ view: "home" }, "");
  loadFeed(DEFAULT_QUERY);
})();

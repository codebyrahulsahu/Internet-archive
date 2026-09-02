(function () {
  "use strict";

  /* ---------- element refs ---------- */
  const grid = document.getElementById("videoGrid");
  const feedStatus = document.getElementById("feedStatus");
  const homeView = document.getElementById("homeView");
  const playerView = document.getElementById("playerView");
  const upNextList = document.getElementById("upNext");
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
  const playerLoading = document.getElementById("playerLoading");
  const pTitle = document.getElementById("pTitle");
  const pMetaLine = document.getElementById("pMetaLine");
  const pDesc = document.getElementById("pDesc");
  const openArchiveLink = document.getElementById("openArchiveLink");
  const playerWrap = document.getElementById("playerWrap");
  const searchBtn = document.getElementById("searchBtn");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");
  const searchClose = document.getElementById("searchClose");

  let currentItem = null;
  let currentIframe = null; // the live <iframe> DOM node, moved between player/mini-player

  const DEFAULT_QUERY = chips.querySelector(".chip.active").dataset.query;

  /* ================= FEED ================= */

  function cardHTML(v) {
    return `
      <article class="card" data-id="${v.identifier}">
        <div class="thumb-wrap">
          <img src="${v.thumbUrl}" alt="" loading="lazy"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-fallback',style:'background:${v.avatarColor}'}))">
        </div>
        <div class="card-body">
          <span class="avatar" style="background:${v.avatarColor}">${v.avatar}</span>
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

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
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
      grid.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => openVideo(card.dataset.id, items.find(i => i.identifier === card.dataset.id)));
      });
      feedStatus.hidden = true;
    } catch (err) {
      feedStatus.textContent = "archive.org से लोड नहीं हो सका — इंटरनेट कनेक्शन चेक करें। (" + err.message + ")";
    }
  }

  async function loadUpNext(relatedTo) {
    upNextList.innerHTML = "";
    try {
      const query = relatedTo ? `mediatype:(movies) AND (${relatedTo})` : DEFAULT_QUERY;
      const docs = await Archive.search(query, 8);
      const items = docs.map(Archive.toCardModel).filter(i => i.identifier !== (currentItem && currentItem.identifier));
      upNextList.innerHTML = items.slice(0, 6).map(upCardHTML).join("");
      upNextList.querySelectorAll(".up-card").forEach(card => {
        card.addEventListener("click", () => openVideo(card.dataset.id, items.find(i => i.identifier === card.dataset.id)));
      });
    } catch (err) {
      upNextList.innerHTML = `<p class="feed-status">सुझाव लोड नहीं हो सके।</p>`;
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
          <span class="up-meta">${v.views} डाउनलोड्स</span>
        </div>
      </div>`;
  }

  /* ================= PLAYER ================= */

  function buildIframe(identifier) {
    const iframe = document.createElement("iframe");
    iframe.src = Archive.embedUrl(identifier);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("webkitallowfullscreen", "true");
    iframe.setAttribute("mozallowfullscreen", "true");
    iframe.className = "archive-iframe";
    iframe.title = "archive.org player";
    return iframe;
  }

  async function openVideo(identifier, quickModel) {
    currentItem = quickModel || { identifier, title: identifier, channel: "Internet Archive" };

    // reset player shell
    pTitle.textContent = currentItem.title;
    pMetaLine.textContent = "लोड हो रहा है…";
    pDesc.textContent = "";
    openArchiveLink.href = Archive.detailsUrl(identifier);
    ambientGlow.style.backgroundImage = `url(${Archive.thumbUrl(identifier)})`;

    // build/attach the real embed iframe (or move it if already playing this item)
    if (currentIframe && currentIframe.dataset.id === identifier) {
      player.innerHTML = "";
      player.appendChild(currentIframe);
    } else {
      if (currentIframe) currentIframe.remove();
      currentIframe = buildIframe(identifier);
      currentIframe.dataset.id = identifier;
      player.innerHTML = "";
      player.appendChild(currentIframe);
    }

    switchToPlayerView();
    hideMiniPlayer();
    loadUpNext();

    try {
      const meta = await Archive.metadata(identifier);
      const m = meta.metadata || {};
      pTitle.textContent = m.title || currentItem.title;
      const creator = Array.isArray(m.creator) ? m.creator[0] : (m.creator || currentItem.channel);
      miniChannel.textContent = creator;
      pMetaLine.textContent = (m.publicdate ? m.publicdate.slice(0, 10) + " · " : "") + "Internet Archive";
      pDesc.innerHTML = escapeHTML(stripHtml(m.description || "इस आइटम के लिए कोई विवरण उपलब्ध नहीं है।")).slice(0, 400);
      loadUpNext(m.subject ? `subject:(${JSON.stringify(m.subject).replace(/[\[\]"]/g, "")})` : null);
    } catch (err) {
      pMetaLine.textContent = "Internet Archive";
      pDesc.textContent = "विवरण लोड नहीं हो सका।";
    }
  }

  function stripHtml(str) {
    const div = document.createElement("div");
    div.innerHTML = Array.isArray(str) ? str.join(" ") : str;
    return div.textContent || div.innerText || "";
  }

  function switchToPlayerView() {
    homeView.hidden = true;
    chips.hidden = true;
    document.getElementById("searchBar").hidden = true;
    playerView.hidden = false;
    backBtn.hidden = false;
    brandLogo.style.display = "none";
    bottomNav.hidden = true;
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    playerView.hidden = true;
    homeView.hidden = false;
    chips.hidden = false;
    backBtn.hidden = true;
    brandLogo.style.display = "flex";
    bottomNav.hidden = false;
    if (currentIframe) showMiniPlayer();
  }

  backBtn.addEventListener("click", goHome);
  bottomNav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      bottomNav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.view === "home") goHome();
    });
  });

  /* ================= MINI PLAYER (moves the live iframe, no reload) ================= */

  function showMiniPlayer() {
    if (!currentIframe) return;
    miniVideoSlot.innerHTML = "";
    miniVideoSlot.appendChild(currentIframe);
    miniTitle.textContent = currentItem.title;
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
    if (currentItem) openVideo(currentItem.identifier, currentItem);
  });

  /* ================= FILTER CHIPS ================= */

  chips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      loadFeed(chip.dataset.query);
    });
  });

  /* ================= SEARCH BAR ================= */

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
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      loadFeed(`title:(${searchInput.value.trim()}) OR subject:(${searchInput.value.trim()})`);
      searchBar.hidden = true;
      chips.hidden = false;
    }
  });

  /* ================= TABS ================= */
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });

  /* ================= INIT ================= */
  loadFeed(DEFAULT_QUERY);
})();

// Thin wrapper around the Internet Archive's public API.
// Docs: https://archive.org/developers/
"use strict";

const Archive = (function () {
  const BASE = "https://archive.org";

  /**
   * Full-text search against archive.org's advancedsearch endpoint.
   * @param {string} query  Archive.org query string (e.g. "collection:(nasa)")
   * @param {number} rows   How many results to fetch
   * @returns {Promise<Array>} array of raw doc objects
   */
  async function search(query, rows = 16) {
    const fields = ["identifier", "title", "description", "creator", "downloads", "mediatype", "publicdate"];
    const params = new URLSearchParams();
    params.set("q", query);
    fields.forEach(f => params.append("fl[]", f));
    params.set("rows", String(rows));
    params.set("page", "1");
    params.set("output", "json");
    params.append("sort[]", "downloads desc");

    const res = await fetch(`${BASE}/advancedsearch.php?${params.toString()}`);
    if (!res.ok) throw new Error(`Archive search failed: ${res.status}`);
    const data = await res.json();
    return (data.response && data.response.docs) || [];
  }

  /** Full item metadata (title, description, files list, etc.) */
  async function metadata(identifier) {
    const res = await fetch(`${BASE}/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) throw new Error(`Archive metadata failed: ${res.status}`);
    return res.json();
  }

  /** Thumbnail/poster image service URL for an item */
  function thumbUrl(identifier) {
    return `${BASE}/services/img/${encodeURIComponent(identifier)}`;
  }

  /** URL for archive.org's own embeddable player (handles video + audio) */
  function embedUrl(identifier) {
    return `${BASE}/embed/${encodeURIComponent(identifier)}`;
  }

  /** URL for the full item detail page on archive.org */
  function detailsUrl(identifier) {
    return `${BASE}/details/${encodeURIComponent(identifier)}`;
  }

  /** Map a raw search doc into the shape our UI cards expect */
  function toCardModel(doc) {
    const title = doc.title || doc.identifier;
    const creator = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || "Internet Archive");
    const initials = (creator || "IA").trim().slice(0, 2).toUpperCase();
    return {
      identifier: doc.identifier,
      title,
      channel: creator,
      avatar: initials,
      avatarColor: colorFromString(creator || doc.identifier),
      views: formatDownloads(doc.downloads),
      time: doc.publicdate ? doc.publicdate.slice(0, 10) : "",
      mediatype: doc.mediatype || "movies",
      thumbUrl: thumbUrl(doc.identifier),
    };
  }

  function formatDownloads(n) {
    n = Number(n) || 0;
    if (n >= 100000) return (n / 100000).toFixed(1) + " लाख";
    if (n >= 1000) return (n / 1000).toFixed(1) + " हज़ार";
    return String(n);
  }

  // deterministic pastel-ish gradient from a string, so repeat creators get a stable color
  function colorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 55) % 360;
    return `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 50%))`;
  }

  return { search, metadata, thumbUrl, embedUrl, detailsUrl, toCardModel };
})();

// Thin wrapper around the Internet Archive's public API.
// Docs: https://archive.org/developers/
"use strict";

const Archive = (function () {
  const BASE = "https://archive.org";

  /**
   * Full-text search against archive.org's advancedsearch endpoint.
   * @param {string} query  Archive.org query string (e.g. "collection:(nasa)")
   * @param {number} rows   How many results to fetch
   * @param {'video'|'audio'|'text'} kind  Enforced media kind — always appended to
   *        the query so items of the wrong mediatype (e.g. a PDF leaking into the
   *        video feed) can never show up in results.
   * @returns {Promise<Array>} array of raw doc objects
   */
  async function search(query, rows = 16, kind = "video") {
    const mediatypeFilter =
      kind === "audio" ? "mediatype:(audio)" :
      kind === "text"  ? "mediatype:(texts)" :
      "mediatype:(movies)";
    const fullQuery = `${mediatypeFilter} AND (${query})`;
    const fields = ["identifier", "title", "description", "creator", "downloads", "mediatype", "publicdate"];
    const params = new URLSearchParams();
    params.set("q", fullQuery);
    fields.forEach(f => params.append("fl[]", f));
    params.set("rows", String(rows));
    params.set("page", "1");
    params.set("output", "json");
    params.append("sort[]", "downloads desc");

    const res = await fetch(`${BASE}/advancedsearch.php?${params.toString()}`);
    if (!res.ok) throw new Error(`Archive search failed: ${res.status}`);
    const data = await res.json();
    const docs = (data.response && data.response.docs) || [];
    // defensive client-side filter in case the API still returns a stray mediatype
    const expected = kind === "audio" ? "audio" : kind === "text" ? "texts" : "movies";
    return docs.filter(d => d.mediatype === expected);
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

  /** Direct file URL for a given item + filename */
  function fileUrl(identifier, filename) {
    return `${BASE}/download/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`;
  }

  const VIDEO_FORMAT_PRIORITY = ["h.264", "MPEG4", "512Kb MPEG4", "Matroska", "Ogg Video", "MPEG2"];
  const AUDIO_FORMAT_PRIORITY = ["VBR MP3", "128Kbps MP3", "MP3", "Ogg Vorbis", "Flac"];

  /**
   * Pick the best playable media file for direct <video>/<audio> playback.
   * @param {Array} files      files array from metadata()
   * @param {string} identifier
   * @param {'video'|'audio'} kind
   * @returns {{url:string, format:string}|null}
   */
  function pickMediaFile(files, identifier, kind) {
    if (!Array.isArray(files) || !files.length) return null;
    const priority = kind === "audio" ? AUDIO_FORMAT_PRIORITY : VIDEO_FORMAT_PRIORITY;
    const extPattern = kind === "audio" ? /\.(mp3|ogg|oga|flac)$/i : /\.(mp4|m4v|ogv|webm)$/i;

    for (const fmt of priority) {
      const match = files.find(f => f.format === fmt);
      if (match) return { url: fileUrl(identifier, match.name), format: match.format };
    }
    const byExt = files.find(f => extPattern.test(f.name || ""));
    if (byExt) return { url: fileUrl(identifier, byExt.name), format: byExt.format || "" };
    return null;
  }

  /**
   * Pick a playable PDF file for the built-in reader (an <iframe>/<embed> pointing
   * straight at the file — the browser's own PDF viewer renders it).
   * @returns {{url:string, format:string}|null}
   */
  function pickPdfFile(files, identifier) {
    if (!Array.isArray(files) || !files.length) return null;
    const pdf = files.find(f => f.format === "Text PDF" || /\.pdf$/i.test(f.name || ""));
    if (pdf) return { url: fileUrl(identifier, pdf.name), format: pdf.format || "PDF" };
    return null;
  }

  const SKIP_DOWNLOAD_FORMATS = new Set([
    "Metadata", "Item Tile", "Thumbnail", "JSON", "Archive BitTorrent",
    "Log", "Item CDX Index", "Item CDX Meta-Index", "PNG",
  ]);

  /** Build a clean list of downloadable files (skips internal/metadata files) */
  function listDownloadFiles(files, identifier, maxItems = 8) {
    if (!Array.isArray(files)) return [];
    return files
      .filter(f => f.name && f.size && !SKIP_DOWNLOAD_FORMATS.has(f.format) && !/_meta\.|_files\.xml|_archive\.torrent/.test(f.name))
      .sort((a, b) => Number(b.size) - Number(a.size))
      .slice(0, maxItems)
      .map(f => ({
        name: f.name,
        format: f.format || f.name.split(".").pop().toUpperCase(),
        size: humanSize(f.size),
        url: fileUrl(identifier, f.name),
      }));
  }

  function humanSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + " KB";
    return bytes + " B";
  }

  /** Normalize archive.org mediatype into 'video' | 'audio' | 'text' | 'other' */
  function kindOf(mediatype) {
    if (mediatype === "movies") return "video";
    if (mediatype === "audio") return "audio";
    if (mediatype === "texts") return "text";
    return "other";
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
      kind: kindOf(doc.mediatype),
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

  return {
    search, metadata, thumbUrl, embedUrl, detailsUrl, fileUrl,
    pickMediaFile, pickPdfFile, listDownloadFiles, humanSize, kindOf, toCardModel,
  };
})();

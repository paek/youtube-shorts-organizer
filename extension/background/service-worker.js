// Background Service Worker (Manifest V3)
// Handles cross-origin helper requests (translation & lyrics lookup) because
// content scripts on youtube.com cannot call external APIs directly due to CORS.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[YTW] service worker installed");
});

function splitIntoChunks(text, maxLen = 1200) {
  if (text.length <= maxLen) return [text];
  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if (line.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += maxLen) {
        chunks.push(line.slice(i, i + maxLen));
      }
      continue;
    }

    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function requestGoogleTranslateChunk(chunk, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(chunk)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => (Array.isArray(part) ? part[0] || "" : "")).join("")
    : "";
  const sourceLang = typeof data?.[2] === "string" ? data[2] : "auto";
  return { translated, sourceLang };
}

async function translateText(text, requestedTarget = "auto") {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return { ok: false, error: "empty_text" };
  }

  const chunks = splitIntoChunks(cleanText, 1200);
  let targetLang = requestedTarget === "auto" ? "ko" : requestedTarget;

  // Probe the first chunk to detect source language; if auto-translating Korean
  // text, switch target to English so the user gets a useful translation.
  let first = await requestGoogleTranslateChunk(chunks[0], targetLang);
  const detectedLang = first.sourceLang;

  if (requestedTarget === "auto" && detectedLang === "ko") {
    targetLang = "en";
    first = await requestGoogleTranslateChunk(chunks[0], targetLang);
  }

  const results = [first.translated];
  for (let i = 1; i < chunks.length; i++) {
    const part = await requestGoogleTranslateChunk(chunks[i], targetLang);
    results.push(part.translated);
  }

  return {
    ok: true,
    translatedText: results.join("\n").trim(),
    sourceLang: detectedLang,
    targetLang,
  };
}

function stripLrcTimestamps(syncedLyrics) {
  return String(syncedLyrics || "")
    .replace(/^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/gm, "")
    .trim();
}

async function fetchLyrics(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    return { ok: false, error: "empty_query" };
  }

  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`LRCLIB HTTP ${res.status}`);
  }

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "not_found" };
  }

  // Prefer an entry with plainLyrics, then syncedLyrics.
  const best =
    items.find((it) => it && typeof it.plainLyrics === "string" && it.plainLyrics.trim()) ||
    items.find((it) => it && typeof it.syncedLyrics === "string" && it.syncedLyrics.trim()) ||
    null;

  if (!best) {
    return { ok: false, error: "instrumental_or_empty" };
  }

  const lyrics =
    (best.plainLyrics && best.plainLyrics.trim()) || stripLrcTimestamps(best.syncedLyrics);

  return {
    ok: true,
    trackName: best.trackName || "",
    artistName: best.artistName || "",
    lyrics,
  };
}

function extractJsonArrayAfterKey(text, keyToken) {
  const keyIdx = text.indexOf(keyToken);
  if (keyIdx === -1) return null;
  const startIdx = text.indexOf("[", keyIdx + keyToken.length);
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }
  return null;
}

function pickBestCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const isEn = (t) => typeof t?.languageCode === "string" && t.languageCode.toLowerCase().startsWith("en");
  // Prefer manual English -> auto-generated English -> any manual -> first track.
  return (
    tracks.find((t) => isEn(t) && t.kind !== "asr" && t.baseUrl) ||
    tracks.find((t) => isEn(t) && t.baseUrl) ||
    tracks.find((t) => t && t.kind !== "asr" && t.baseUrl) ||
    tracks.find((t) => t && t.baseUrl) ||
    null
  );
}

async function fetchYouTubeCaptions(videoId) {
  const cleanId = String(videoId || "").trim();
  if (!cleanId) {
    return { ok: false, error: "empty_video_id" };
  }

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}&hl=en`, {
    credentials: "include",
  });
  if (!pageRes.ok) {
    throw new Error(`YouTube watch HTTP ${pageRes.status}`);
  }
  const html = await pageRes.text();

  const rawArray = extractJsonArrayAfterKey(html, '"captionTracks":');
  if (!rawArray) {
    return { ok: false, error: "no_captions" };
  }

  let tracks;
  try {
    tracks = JSON.parse(rawArray);
  } catch (_err) {
    return { ok: false, error: "parse_tracks_failed" };
  }

  const track = pickBestCaptionTrack(tracks);
  if (!track || !track.baseUrl) {
    return { ok: false, error: "no_captions" };
  }

  const timedUrl = new URL(track.baseUrl);
  timedUrl.searchParams.set("fmt", "json3");

  const capRes = await fetch(timedUrl.toString());
  if (!capRes.ok) {
    throw new Error(`Caption fetch HTTP ${capRes.status}`);
  }
  const capData = await capRes.json();
  const events = Array.isArray(capData?.events) ? capData.events : [];

  const segments = [];
  for (const ev of events) {
    if (!ev || !Array.isArray(ev.segs)) continue;
    const text = ev.segs
      .map((s) => (s && typeof s.utf8 === "string" ? s.utf8 : ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const startSec = (Number(ev.tStartMs) || 0) / 1000;
    const durSec = (Number(ev.dDurationMs) || 2500) / 1000;
    segments.push({
      startSec,
      endSec: startSec + Math.max(durSec, 0.4),
      text,
    });
  }

  if (segments.length === 0) {
    return { ok: false, error: "empty_captions" };
  }

  return {
    ok: true,
    languageCode: track.languageCode || "unknown",
    isAutoGenerated: track.kind === "asr",
    segments,
  };
}

function extractAllJsonObjectsAfterKey(text, keyToken, maxMatches = 8) {
  const results = [];
  let searchFrom = 0;

  while (results.length < maxMatches) {
    const keyIdx = text.indexOf(keyToken, searchFrom);
    if (keyIdx === -1) break;
    const startIdx = text.indexOf("{", keyIdx + keyToken.length);
    if (startIdx === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    if (endIdx === -1) break;
    results.push(text.slice(startIdx, endIdx));
    searchFrom = endIdx;
  }

  return results;
}

function cleanServerMusicTitle(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(
      /\s*(이 사운드로 만든\s*Shorts.*|이 오디오로 만든\s*Shorts.*|See more videos using this sound.*|Original sound\s*-\s*)$/i,
      ""
    )
    .trim();
}

function extractMusicFromHtml(html) {
  let title = "";
  let song = "";
  let artist = "";
  let sourceUrl = null;
  let songVideoId = null;

  const srcMatch = html.match(/"canonicalBaseUrl":"(\/source\/[^"]+)"/);
  if (srcMatch && srcMatch[1]) {
    sourceUrl = `https://www.youtube.com${srcMatch[1]}`;
  } else {
    const urlMatch = html.match(/"url":"(\/source\/[^"]+)"/);
    if (urlMatch && urlMatch[1]) {
      sourceUrl = `https://www.youtube.com${urlMatch[1]}`;
    }
  }

  // 1. Official "Music in this video" card (watch page / structured description):
  //    gives exact untruncated song title, artist, AND official song videoId!
  const attrBlocks = extractAllJsonObjectsAfterKey(html, '"videoAttributeViewModel":', 6);
  for (const rawAttr of attrBlocks) {
    try {
      const attr = JSON.parse(rawAttr);
      const t = cleanServerMusicTitle(attr?.title || "");
      const sub = cleanServerMusicTitle(attr?.subtitle || "");
      const vid =
        attr?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
        attr?.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
        null;
      if (t) {
        song = t;
        artist = sub;
        title = sub ? `${t} · ${sub}` : t;
        if (vid) songVideoId = vid;
        break;
      }
    } catch (_err) {
      // ignore malformed block
    }
  }

  // 2. Shorts sound metadata / pivot button view models.
  if (!title) {
    const candidateKeys = [
      '"reelSoundMetadataViewModel":',
      '"soundMetadata":',
      '"reelPivotButtonViewModel":',
      '"pivotButtonViewModel":',
      '"pivotButtonRenderer":',
    ];

    for (const key of candidateKeys) {
      const blocks = extractAllJsonObjectsAfterKey(html, key, 4);
      for (const rawObj of blocks) {
        try {
          const obj = JSON.parse(rawObj);
          const found =
            obj?.soundTitle?.content ||
            obj?.title?.content ||
            obj?.title?.simpleText ||
            obj?.soundAttribution?.title ||
            obj?.contentDescription ||
            obj?.accessibilityText ||
            obj?.pivotButtonViewModel?.accessibilityText ||
            obj?.soundMetadata?.title?.content ||
            "";
          const cleaned = cleanServerMusicTitle(found);
          if (cleaned && !/^(사운드|오디오|음악|sound|audio|music)$/i.test(cleaned)) {
            title = cleaned;
            break;
          }
        } catch (_err) {
          // ignore
        }
      }
      if (title) break;
    }
  }

  // 3. Fallback: Shorts bottom-left music pill (buttonViewModel / suggestedAction
  //    with MUSIC icon or /source/ command).
  if (!title) {
    const btnBlocks = extractAllJsonObjectsAfterKey(html, '"buttonViewModel":', 25);
    for (const rawBtn of btnBlocks) {
      if (!/MUSIC|AUDIO|\/source\//i.test(rawBtn)) continue;
      try {
        const btn = JSON.parse(rawBtn);
        const found = btn?.title || btn?.accessibilityText || "";
        const cleaned = cleanServerMusicTitle(found);
        if (
          cleaned &&
          cleaned.length >= 2 &&
          !/^(사운드|오디오|음악|구독|공유|리믹스|좋아요|싫어요|sound|audio|music)$/i.test(cleaned)
        ) {
          title = cleaned;
          break;
        }
      } catch (_err) {
        // ignore
      }
    }
  }

  return { title, song, artist, sourceUrl, songVideoId };
}

async function fetchShortsMusicMeta(videoId) {
  const cleanId = String(videoId || "").trim();
  if (!cleanId) return { ok: false, error: "empty_video_id" };

  let best = { title: "", song: "", artist: "", sourceUrl: null, songVideoId: null };

  // Fetch /watch?v= first — YouTube includes the untruncated official Music card
  // (videoAttributeViewModel with song + artist + official song videoId) here!
  try {
    const watchRes = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}&hl=ko`,
      { credentials: "include" }
    );
    if (watchRes.ok) {
      const watchHtml = await watchRes.text();
      best = extractMusicFromHtml(watchHtml);
    }
  } catch (_err) {
    // continue to /shorts/ fallback
  }

  // If /watch?v= didn't have music metadata (or lacked /source/ link), also check /shorts/.
  if (!best.title || !best.sourceUrl) {
    try {
      const shortsRes = await fetch(
        `https://www.youtube.com/shorts/${encodeURIComponent(cleanId)}`,
        { credentials: "include" }
      );
      if (shortsRes.ok) {
        const shortsHtml = await shortsRes.text();
        const fromShorts = extractMusicFromHtml(shortsHtml);
        if (!best.title && fromShorts.title) {
          best.title = fromShorts.title;
          best.song = fromShorts.song || best.song;
          best.artist = fromShorts.artist || best.artist;
        }
        if (!best.sourceUrl && fromShorts.sourceUrl) {
          best.sourceUrl = fromShorts.sourceUrl;
        }
        if (!best.songVideoId && fromShorts.songVideoId) {
          best.songVideoId = fromShorts.songVideoId;
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  if (!best.title) {
    return { ok: false, error: "no_music_meta", sourceUrl: best.sourceUrl };
  }

  const searchQuery = best.title
    .replace(/^(original sound|원본 사운드|오리지널 사운드)\s*[-·•:|]\s*/i, "")
    .replace(/\s*[·•]\s*/g, " - ")
    .replace(/\.{3,}$|…$/g, "")
    .trim();

  return {
    ok: true,
    title: best.title,
    song: best.song,
    artist: best.artist,
    searchQuery: searchQuery || best.title,
    sourceUrl: best.sourceUrl,
    songVideoId: best.songVideoId,
    hasMusic: true,
  };
}

let detachedWindowId = null;
let detachedTargetTabId = null;

function notifyTabDetachedStatus(tabId, detached) {
  if (typeof tabId !== "number") return;
  chrome.tabs.sendMessage(tabId, { type: "YTW_DETACHED_STATUS", detached }).catch(() => { });
}

async function findActiveShortsTabId() {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://www.youtube.com/shorts/*", "https://m.youtube.com/shorts/*"],
    });
    if (!tabs || tabs.length === 0) return null;
    const active = tabs.find((t) => t.active) || tabs[0];
    return typeof active.id === "number" ? active.id : null;
  } catch (_err) {
    return null;
  }
}

async function openDetachedWindow(tabId, sourceWindowId) {
  if (!chrome.windows || typeof chrome.windows.create !== "function") {
    return { ok: false, error: "detached_window_not_supported_on_this_platform" };
  }
  if (typeof tabId === "number") {
    detachedTargetTabId = tabId;
  } else if (detachedTargetTabId === null) {
    detachedTargetTabId = await findActiveShortsTabId();
  }

  if (detachedWindowId !== null) {
    try {
      await chrome.windows.get(detachedWindowId);
      await chrome.windows.update(detachedWindowId, { focused: true, drawAttention: true });
      notifyTabDetachedStatus(detachedTargetTabId, true);
      return { ok: true, windowId: detachedWindowId };
    } catch (_err) {
      detachedWindowId = null;
    }
  }

  const url = chrome.runtime.getURL(
    `detached/detached.html?tabId=${encodeURIComponent(String(detachedTargetTabId ?? ""))}`
  );

  const createOpts = {
    url,
    type: "popup",
    width: 350,
    height: 700,
    focused: true,
  };

  if (typeof sourceWindowId === "number") {
    try {
      const parentWin = await chrome.windows.get(sourceWindowId);
      if (parentWin && Number.isFinite(parentWin.left) && Number.isFinite(parentWin.width)) {
        createOpts.left = Math.max(0, Math.round(parentWin.left + parentWin.width - 370));
      }
      if (parentWin && Number.isFinite(parentWin.top)) {
        createOpts.top = Math.max(0, Math.round(parentWin.top + 60));
      }
    } catch (_err) {
      // ignore positioning hint failure
    }
  }

  const win = await chrome.windows.create(createOpts);
  detachedWindowId = win && typeof win.id === "number" ? win.id : null;
  notifyTabDetachedStatus(detachedTargetTabId, true);
  return { ok: true, windowId: detachedWindowId };
}

if (chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((removedId) => {
    if (removedId === detachedWindowId) {
      detachedWindowId = null;
      notifyTabDetachedStatus(detachedTargetTabId, false);
    }
  });
}

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    const tabId = tab && typeof tab.id === "number" ? tab.id : undefined;
    const winId = tab && typeof tab.windowId === "number" ? tab.windowId : undefined;
    openDetachedWindow(tabId, winId).catch((err) => {
      console.warn("[YTW] action click openDetachedWindow failed:", err);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "YTW_OPEN_DETACHED") {
    const tabId = sender && sender.tab ? sender.tab.id : message.tabId;
    const sourceWinId = sender && sender.tab ? sender.tab.windowId : undefined;
    openDetachedWindow(tabId, sourceWinId)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.warn("[YTW] openDetachedWindow failed:", err);
        sendResponse({ ok: false, error: err && err.message ? err.message : "open_failed" });
      });
    return true;
  }

  if (message.type === "YTW_GET_DETACHED_STATUS") {
    const tabId = sender && sender.tab ? sender.tab.id : null;
    const isThisTabDetached =
      detachedWindowId !== null && (detachedTargetTabId === null || detachedTargetTabId === tabId);
    sendResponse({ ok: true, detached: isThisTabDetached, targetTabId: detachedTargetTabId });
    return false;
  }

  if (message.type === "YTW_RELAY_TO_TAB") {
    (async () => {
      let targetTabId =
        typeof message.tabId === "number" ? message.tabId : detachedTargetTabId;
      if (typeof targetTabId !== "number") {
        targetTabId = await findActiveShortsTabId();
        detachedTargetTabId = targetTabId;
      }
      if (typeof targetTabId !== "number") {
        return { ok: false, error: "no_target_tab" };
      }
      try {
        const res = await chrome.tabs.sendMessage(targetTabId, {
          type: "YTW_TAB_CMD",
          command: message.command,
          payload: message.payload,
        });
        return res || { ok: true };
      } catch (_firstErr) {
        // Retry once against the currently active Shorts tab in case tabId changed.
        const fallbackTabId = await findActiveShortsTabId();
        if (typeof fallbackTabId === "number" && fallbackTabId !== targetTabId) {
          detachedTargetTabId = fallbackTabId;
          const res = await chrome.tabs.sendMessage(fallbackTabId, {
            type: "YTW_TAB_CMD",
            command: message.command,
            payload: message.payload,
          });
          return res || { ok: true };
        }
        return { ok: false, error: "tab_unreachable" };
      }
    })()
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ ok: false, error: err && err.message ? err.message : "tab_unreachable" });
      });
    return true;
  }

  if (message.type === "YTW_TRANSLATE") {
    translateText(message.text, message.targetLang || "auto")
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.warn("[YTW] translate failed:", err);
        sendResponse({ ok: false, error: err && err.message ? err.message : "translate_failed" });
      });
    return true;
  }

  if (message.type === "YTW_FETCH_LYRICS") {
    fetchLyrics(message.query)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.warn("[YTW] lyrics lookup failed:", err);
        sendResponse({ ok: false, error: err && err.message ? err.message : "lyrics_failed" });
      });
    return true;
  }

  if (message.type === "YTW_FETCH_CAPTIONS") {
    fetchYouTubeCaptions(message.videoId)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.warn("[YTW] caption lookup failed:", err);
        sendResponse({ ok: false, error: err && err.message ? err.message : "captions_failed" });
      });
    return true;
  }

  if (message.type === "YTW_FETCH_MUSIC_META") {
    fetchShortsMusicMeta(message.videoId)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.warn("[YTW] music meta lookup failed:", err);
        sendResponse({ ok: false, error: err && err.message ? err.message : "music_meta_failed" });
      });
    return true;
  }

  return false;
});

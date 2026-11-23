// ==UserScript==
// @name         YouTube Shorts Organizer & Learning Player
// @namespace    https://github.com/paek/youtube-shorts-organizer
// @version      0.3.0
// @description  Shorts N-times repeat & 2s auto-next, speed, A-B loop, favorites-only playback, per-video memo, music links, and ad/sponsor auto-skip for iOS Safari, macOS Safari, and Android browsers.
// @author       Baek Hung-Ju
// @license      GPL-3.0
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  if (window.__YTW_USERSCRIPT_LOADED__) return;
  window.__YTW_USERSCRIPT_LOADED__ = true;

  const STORAGE_KEYS = {
    SETTINGS: "ytw_us_settings_v1",
    FAVORITES: "ytw_us_favorites_v1",
    MEMOS: "ytw_us_memos_v1",
  };

  const DEFAULT_SETTINGS = {
    repeatCount: 1,
    playbackRate: 1,
    autoSkipSponsored: true,
    favoritesOnly: false,
    favoritesShuffle: true,
    collapsed: window.innerWidth <= 640,
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_e) {
      // ignore quota/private-mode errors
    }
  }

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJson(STORAGE_KEYS.SETTINGS, {}));
  }

  function saveSettings(partial) {
    const next = Object.assign({}, getSettings(), partial);
    writeJson(STORAGE_KEYS.SETTINGS, next);
    return next;
  }

  function getFavoritesMap() {
    return readJson(STORAGE_KEYS.FAVORITES, {});
  }

  function getFavoritesList() {
    return Object.values(getFavoritesMap()).sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  }

  function toggleFavorite(meta) {
    const map = getFavoritesMap();
    if (map[meta.videoId]) {
      delete map[meta.videoId];
    } else {
      map[meta.videoId] = Object.assign({ createdAt: new Date().toISOString() }, meta);
    }
    writeJson(STORAGE_KEYS.FAVORITES, map);
    return Boolean(map[meta.videoId]);
  }

  function removeFavorite(videoId) {
    const map = getFavoritesMap();
    if (map[videoId]) {
      delete map[videoId];
      writeJson(STORAGE_KEYS.FAVORITES, map);
    }
  }

  function getMemo(videoId) {
    return readJson(STORAGE_KEYS.MEMOS, {})[videoId] || "";
  }

  function saveMemo(videoId, text) {
    const map = readJson(STORAGE_KEYS.MEMOS, {});
    if (text) map[videoId] = text;
    else delete map[videoId];
    writeJson(STORAGE_KEYS.MEMOS, map);
  }

  function isShortsPage() {
    return location.pathname.startsWith("/shorts/");
  }

  function getVideoId() {
    const m = location.pathname.match(/^\/shorts\/([^/?]+)/);
    return m ? m[1] : null;
  }

  function findActiveVideo() {
    const selectors = [
      "ytd-reel-video-renderer[is-active] video.video-stream",
      "ytm-reel-video-renderer[is-active] video",
      "reel-video-in-sequence-new-view-model video",
      "#shorts-player video",
      "video.video-stream",
      "video",
    ];
    const midY = window.innerHeight / 2;
    for (const sel of selectors) {
      const list = document.querySelectorAll(sel);
      if (list.length === 1) return list[0];
      if (list.length > 1) {
        const playing = Array.from(list).find((v) => !v.paused);
        if (playing) return playing;
        const visible = Array.from(list).find((v) => {
          const r = v.getBoundingClientRect();
          return r.top <= midY && r.bottom >= midY;
        });
        if (visible) return visible;
        return list[0];
      }
    }
    return null;
  }

  function isVisibleCenter(el) {
    if (!el) return false;
    if (el.closest && el.closest("#ytw-us-host")) return false;
    const parentReel = el.closest && el.closest("ytd-reel-video-renderer, ytm-reel-video-renderer");
    if (parentReel && !parentReel.hasAttribute("is-active")) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cy = (r.top + r.bottom) / 2;
    return cy >= 30 && cy <= window.innerHeight - 10;
  }

  const EXACT_AD_RE = /^(스폰서|광고|sponsored|ad|유료\s*광고|유료\s*프로모션|협찬)$/i;
  const DISCLOSURE_RE =
    /(paid promotion|includes paid promotion|sponsored|스폰서|유료\s*프로모션|유료\s*광고|협찬)/i;

  function detectSponsoredShort() {
    const adSelectors = [
      "ytd-ad-slot-renderer",
      "ytm-ad-slot-renderer",
      "ad-badge-view-model",
      "ad-avatar-lockup-view-model",
      "ad-button-view-model",
      ".ytp-paid-content-overlay",
    ];
    for (const sel of adSelectors) {
      const nodes = document.querySelectorAll(sel);
      for (const n of nodes) {
        if (isVisibleCenter(n)) return true;
      }
    }
    const badges = document.querySelectorAll(
      "badge-shape, .yt-badge-shape__text, yt-badge-view-model, ytd-reel-player-overlay-renderer span, [aria-label]"
    );
    for (const el of badges) {
      if (!isVisibleCenter(el)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t && t.length <= 50 && EXACT_AD_RE.test(t)) return true;
      const aria = (el.getAttribute("aria-label") || "").trim();
      const combined = `${t} ${aria}`.trim();
      if (combined && combined.length <= 120 && DISCLOSURE_RE.test(combined)) return true;
    }
    return false;
  }

  function findMusicTitle() {
    const sels = [
      "reel-sound-metadata-view-model",
      "yt-reel-sound-metadata-view-model",
      "a[href*='/source/']",
      "reel-pivot-button-view-model a, reel-pivot-button-view-model button",
    ];
    for (const sel of sels) {
      const nodes = document.querySelectorAll(sel);
      for (const n of nodes) {
        if (!isVisibleCenter(n)) continue;
        const txt = (n.textContent || n.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .replace(/\s*(이 사운드로 만든\s*Shorts.*|See more videos using this sound.*)$/i, "")
          .trim();
        if (txt && txt.length >= 2) return txt;
      }
    }
    return "";
  }

  function goToNextShort() {
    const nextBtn = document.querySelector(
      "#navigation-button-down button, button[aria-label*='Next video'], button[aria-label*='다음 동영상']"
    );
    if (nextBtn) {
      nextBtn.click();
      return;
    }
    const container = document.querySelector(
      "#shorts-container, ytd-shorts #contents, .reel-video-in-sequence, ytm-shorts"
    );
    if (container && container.scrollHeight > container.clientHeight + 20) {
      container.scrollBy({ top: window.innerHeight, behavior: "smooth" });
      return;
    }
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  }

  function advanceNext() {
    const s = getSettings();
    if (s.favoritesOnly) {
      const favs = getFavoritesList();
      if (favs.length > 0) {
        const curId = getVideoId();
        let next = favs[0];
        if (favs.length > 1) {
          if (s.favoritesShuffle !== false) {
            const pool = favs.filter((f) => f.videoId !== curId);
            next = pool[Math.floor(Math.random() * pool.length)] || favs[0];
          } else {
            const idx = favs.findIndex((f) => f.videoId === curId);
            next = favs[(idx + 1) % favs.length];
          }
        }
        if (next && next.videoId && next.videoId !== curId) {
          location.assign(`${location.origin}/shorts/${encodeURIComponent(next.videoId)}`);
          return;
        }
      }
    }
    goToNextShort();
  }

  // Regular watch-page ad auto-skip (respects the same autoSkipSponsored toggle)
  setInterval(() => {
    if (!getSettings().autoSkipSponsored) return;
    const adPlayer = document.querySelector(
      ".html5-video-player.ad-showing, .html5-video-player.ad-interrupting"
    );
    if (!adPlayer) return;
    const skipBtn = document.querySelector(
      ".ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button"
    );
    if (skipBtn && skipBtn.getBoundingClientRect().width > 0) {
      skipBtn.click();
      return;
    }
    const vid = adPlayer.querySelector("video");
    if (vid) {
      vid.muted = true;
      if (Number.isFinite(vid.duration) && vid.duration > 0) {
        try {
          vid.currentTime = vid.duration;
        } catch (_e) {}
      }
    }
  }, 400);

  // Player state machine (2s post-video delay)
  let attachedVideo = null;
  let lastVideoId = null;
  let repeatIndex = 0;
  let lastTime = 0;
  let lastDur = 0;
  let attachedAt = 0;
  let exhausted = false;
  let advanceTimer = null;
  let lastAdSkipAt = 0;
  let abA = null;
  let abB = null;

  function clearAdvance() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function triggerFinish() {
    if (!attachedVideo || exhausted) return;
    if (Date.now() - attachedAt < 800) return;
    const s = getSettings();
    const target = s.repeatCount === "inf" ? Infinity : Number(s.repeatCount) || 1;
    if (target === Infinity || repeatIndex < target - 1) {
      repeatIndex += 1;
      attachedVideo.currentTime = 0;
      lastTime = 0;
      attachedVideo.play().catch(() => {});
      updateBadge();
      return;
    }
    exhausted = true;
    try {
      attachedVideo.pause();
    } catch (_e) {}
    clearAdvance();
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      advanceNext();
    }, 2000);
  }

  function onTimeUpdate() {
    if (!attachedVideo) return;
    const s = getSettings();
    if (attachedVideo.loop) attachedVideo.loop = false;
    if (s.playbackRate && attachedVideo.playbackRate !== s.playbackRate) {
      attachedVideo.playbackRate = s.playbackRate;
    }
    if (abA !== null && abB !== null && attachedVideo.currentTime >= abB) {
      attachedVideo.currentTime = abA;
      lastTime = abA;
      return;
    }
    const dur = attachedVideo.duration;
    if (
      !exhausted &&
      Date.now() - attachedAt > 800 &&
      Number.isFinite(dur) &&
      dur > 1.5 &&
      lastDur > 0 &&
      Math.abs(dur - lastDur) < 0.25 &&
      lastTime > dur - 0.5 &&
      attachedVideo.currentTime < 1.0 &&
      attachedVideo.currentTime < lastTime - 1.0
    ) {
      lastTime = attachedVideo.currentTime;
      triggerFinish();
      return;
    }
    lastTime = attachedVideo.currentTime;
    lastDur = Number.isFinite(dur) ? dur : 0;
  }

  function onEnded() {
    if (
      attachedVideo &&
      Number.isFinite(attachedVideo.duration) &&
      attachedVideo.duration > 1.5 &&
      attachedVideo.currentTime < attachedVideo.duration - 1.0
    ) {
      return;
    }
    triggerFinish();
  }

  function onMediaReset() {
    lastTime = 0;
    lastDur = attachedVideo && Number.isFinite(attachedVideo.duration) ? attachedVideo.duration : 0;
  }

  function attachVideo(v) {
    if (attachedVideo) {
      attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
      attachedVideo.removeEventListener("ended", onEnded);
      attachedVideo.removeEventListener("loadedmetadata", onMediaReset);
      attachedVideo.removeEventListener("emptied", onMediaReset);
    }
    clearAdvance();
    attachedVideo = v;
    repeatIndex = 0;
    lastTime = 0;
    lastDur = v && Number.isFinite(v.duration) ? v.duration : 0;
    attachedAt = Date.now();
    exhausted = false;
    abA = null;
    abB = null;
    if (!v) return;
    v.loop = false;
    const s = getSettings();
    if (s.playbackRate) v.playbackRate = s.playbackRate;
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onMediaReset);
    v.addEventListener("emptied", onMediaReset);
  }

  // Shadow DOM UI
  let host = null;
  let root = null;

  function q(role) {
    return root ? root.querySelector(`[data-role="${role}"]`) : null;
  }

  function updateBadge() {
    const b = q("badge");
    if (!b) return;
    const s = getSettings();
    b.textContent = s.repeatCount === "inf" ? `${repeatIndex + 1}/∞` : `${repeatIndex + 1}/${s.repeatCount}`;
  }

  function renderUI() {
    if (!root) return;
    const s = getSettings();
    const vid = getVideoId();
    root.classList.toggle("collapsed", Boolean(s.collapsed));
    q("toggle").textContent = s.collapsed ? "▸" : "▾";
    updateBadge();

    Array.from(q("rep").children).forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.v === String(s.repeatCount))
    );
    Array.from(q("spd").children).forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.v === String(s.playbackRate))
    );
    q("ab").textContent = `A:${abA !== null ? abA.toFixed(1) : "--"} / B:${abB !== null ? abB.toFixed(1) : "--"}`;

    const isFav = vid ? Boolean(getFavoritesMap()[vid]) : false;
    q("fav").textContent = isFav ? "★ 즐겨찾기됨" : "☆ 즐겨찾기 추가";
    q("fav").classList.toggle("is-fav", isFav);
    q("fav-only").checked = Boolean(s.favoritesOnly);
    q("fav-order").textContent = s.favoritesShuffle !== false ? "랜덤" : "순서";
    q("skip-ad").checked = Boolean(s.autoSkipSponsored);

    if (vid && document.activeElement !== q("memo")) {
      q("memo").value = getMemo(vid);
    }

    const music = findMusicTitle();
    if (music && document.activeElement !== q("music")) {
      q("music").value = music;
    }

    const listEl = q("fav-list");
    const favs = getFavoritesList();
    q("fav-count").textContent = `★ 즐겨찾기 (${favs.length})`;
    listEl.textContent = "";
    favs.forEach((f) => {
      const row = document.createElement("div");
      row.className = "fav-row";
      const btn = document.createElement("span");
      btn.className = "fav-title";
      btn.textContent = f.title || f.videoId;
      btn.onclick = () => location.assign(`${location.origin}/shorts/${encodeURIComponent(f.videoId)}`);
      const del = document.createElement("button");
      del.textContent = "✕";
      del.onclick = () => {
        removeFavorite(f.videoId);
        renderUI();
      };
      row.appendChild(btn);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  function mountUI() {
    if (host && document.contains(host)) return;
    document.querySelectorAll("#ytw-us-host").forEach((el) => el.remove());

    host = document.createElement("div");
    host.id = "ytw-us-host";
    host.style.cssText =
      "position:fixed!important;top:64px;right:10px;z-index:2147483647!important;pointer-events:auto!important;";

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Roboto,sans-serif}
      .p{width:min(264px,calc(100vw - 20px));background:rgba(18,18,22,.94);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.55);font-size:12px;overflow:hidden}
      .p.collapsed{width:auto}.p.collapsed .b{display:none}
      .h{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 10px;background:rgba(255,255,255,.06);cursor:grab;touch-action:none;font-weight:700}
      .b{padding:9px;display:flex;flex-direction:column;gap:8px;max-height:72vh;overflow-y:auto}
      .r{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
      button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:4px 7px;font-size:11px;cursor:pointer}
      button.active{background:#e62117;border-color:#ff443a}
      button.is-fav{background:rgba(255,193,7,.22);border-color:#ffd54f;color:#ffd54f}
      input[type="text"],textarea{width:100%;background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:5px 7px;font-size:11.5px}
      textarea{min-height:48px}
      .lbl{font-size:10.5px;color:rgba(255,255,255,.65);display:flex;justify-content:space-between}
      .chk{display:flex;align-items:center;gap:6px;font-size:11.5px}
      .fav-list{max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:3px}
      .fav-row{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.05);padding:3px 6px;border-radius:5px}
      .fav-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-size:11px}
    `;
    shadow.appendChild(style);

    root = document.createElement("div");
    root.className = "p";
    root.innerHTML = `
      <div class="h" data-role="drag">
        <span>YT Organizer</span>
        <span style="display:flex;gap:5px;align-items:center">
          <span data-role="badge" style="font-size:10.5px;opacity:.85">1/1</span>
          <button data-role="toggle">▾</button>
        </span>
      </div>
      <div class="b">
        <div class="lbl"><span>Repeat (2초 후 자동넘김)</span></div>
        <div class="r" data-role="rep"></div>
        <div class="lbl"><span>Speed</span></div>
        <div class="r" data-role="spd"></div>
        <div class="lbl"><span>A-B Loop</span><span data-role="ab">A:-- / B:--</span></div>
        <div class="r">
          <button data-role="set-a">Set A</button>
          <button data-role="set-b">Set B</button>
          <button data-role="clr-ab">Clear</button>
          <button data-role="next">다음 ⏭</button>
        </div>
        <button data-role="fav">☆ 즐겨찾기 추가</button>
        <div class="r" style="justify-content:space-between">
          <label class="chk"><input type="checkbox" data-role="fav-only"><span>즐겨찾기만 연속재생</span></label>
          <button data-role="fav-order">랜덤</button>
        </div>
        <div class="lbl"><span data-role="fav-count">★ 즐겨찾기 (0)</span></div>
        <div class="fav-list" data-role="fav-list"></div>
        <div class="lbl"><span>🎵 음악 / 번역</span></div>
        <input type="text" data-role="music" placeholder="곡명 (자동감지 또는 입력)">
        <div class="r">
          <button data-role="m-tr">번역</button>
          <button data-role="m-yt">▶ YT</button>
          <button data-role="m-ytm">🎵 Music</button>
        </div>
        <div class="lbl"><span>Memo</span></div>
        <textarea data-role="memo" placeholder="메모 입력..."></textarea>
        <button data-role="memo-save">메모 저장</button>
        <label class="chk"><input type="checkbox" data-role="skip-ad"><span>광고/스폰서 자동 넘김</span></label>
      </div>
    `;
    shadow.appendChild(root);
    (document.body || document.documentElement).appendChild(host);

    // Populate repeat/speed buttons
    [1, 3, 5, 10, "inf"].forEach((v) => {
      const b = document.createElement("button");
      b.dataset.v = String(v);
      b.textContent = v === "inf" ? "∞" : String(v);
      b.onclick = () => {
        saveSettings({ repeatCount: v });
        repeatIndex = 0;
        exhausted = false;
        clearAdvance();
        renderUI();
      };
      q("rep").appendChild(b);
    });

    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach((v) => {
      const b = document.createElement("button");
      b.dataset.v = String(v);
      b.textContent = `${v}x`;
      b.onclick = () => {
        saveSettings({ playbackRate: v });
        if (attachedVideo) attachedVideo.playbackRate = v;
        renderUI();
      };
      q("spd").appendChild(b);
    });

    q("toggle").onclick = (e) => {
      e.stopPropagation();
      saveSettings({ collapsed: !getSettings().collapsed });
      renderUI();
    };
    q("set-a").onclick = () => {
      if (attachedVideo) abA = attachedVideo.currentTime;
      renderUI();
    };
    q("set-b").onclick = () => {
      if (attachedVideo && abA !== null && attachedVideo.currentTime > abA) {
        abB = attachedVideo.currentTime;
        attachedVideo.currentTime = abA;
      }
      renderUI();
    };
    q("clr-ab").onclick = () => {
      abA = null;
      abB = null;
      renderUI();
    };
    q("next").onclick = () => advanceNext();
    q("fav").onclick = () => {
      const vid = getVideoId();
      if (!vid) return;
      toggleFavorite({ videoId: vid, title: document.title.replace(/\s*-\s*YouTube$/i, "") });
      renderUI();
    };
    q("fav-only").onchange = (e) => saveSettings({ favoritesOnly: e.target.checked });
    q("fav-order").onclick = () => {
      saveSettings({ favoritesShuffle: !(getSettings().favoritesShuffle !== false) });
      renderUI();
    };
    q("memo-save").onclick = () => {
      const vid = getVideoId();
      if (vid) saveMemo(vid, q("memo").value);
    };
    q("skip-ad").onchange = (e) => saveSettings({ autoSkipSponsored: e.target.checked });
    q("m-tr").onclick = () => {
      const txt = q("music").value.trim();
      if (txt) window.open(`https://translate.google.com/?sl=auto&tl=ko&text=${encodeURIComponent(txt)}&op=translate`, "_blank");
    };
    q("m-yt").onclick = () => {
      const txt = q("music").value.trim();
      if (txt) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(txt)}`, "_blank");
    };
    q("m-ytm").onclick = () => {
      const txt = q("music").value.trim();
      if (txt) window.open(`https://music.youtube.com/search?q=${encodeURIComponent(txt)}`, "_blank");
    };

    ["keydown", "keyup", "keypress"].forEach((ev) => {
      q("memo").addEventListener(ev, (e) => e.stopPropagation());
      q("music").addEventListener(ev, (e) => e.stopPropagation());
    });

    // Touch & mouse drag
    let drag = false;
    let ox = 0;
    let oy = 0;
    q("drag").addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      drag = true;
      const r = host.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag || !host) return;
      const r = host.getBoundingClientRect();
      host.style.left = `${Math.min(Math.max(6, e.clientX - ox), Math.max(6, window.innerWidth - r.width - 6))}px`;
      host.style.top = `${Math.min(Math.max(6, e.clientY - oy), Math.max(6, window.innerHeight - r.height - 6))}px`;
      host.style.right = "auto";
    });
    window.addEventListener("pointerup", () => {
      drag = false;
    });
  }

  function unmountUI() {
    if (host) host.remove();
    host = null;
    root = null;
  }

  function sync() {
    if (!isShortsPage()) {
      unmountUI();
      attachVideo(null);
      lastVideoId = null;
      return;
    }
    const vid = getVideoId();
    const vEl = findActiveVideo();
    if (!vEl) return;

    mountUI();

    const s = getSettings();
    if (s.autoSkipSponsored && Date.now() - lastAdSkipAt > 1500 && detectSponsoredShort()) {
      lastAdSkipAt = Date.now();
      attachVideo(null);
      goToNextShort();
      return;
    }

    if (vEl !== attachedVideo || vid !== lastVideoId) {
      lastVideoId = vid;
      attachVideo(vEl);
      renderUI();
      setTimeout(renderUI, 700);
    }
  }

  document.addEventListener("yt-navigate-finish", sync);
  window.addEventListener("popstate", sync);
  setInterval(sync, 800);
  sync();
})();

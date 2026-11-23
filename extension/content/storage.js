// Storage — Phase 1 MVP uses chrome.storage.local directly (CLAUDE.md 22장
// MVP 범위). This will be replaced by the SQLite(WASM+OPFS) layer from 2.3절
// once Phase 2+ needs relational queries; the function signatures here are
// written so callers won't need to change when that happens.
(function () {
  window.__YTW = window.__YTW || {};

  const KEYS = {
    SETTINGS: "ytw_settings",
    FAVORITES: "ytw_favorites", // { [videoId]: FavoriteRecord }
    MEMOS: "ytw_memos", // { [videoId]: string }
  };

  const DEFAULT_SETTINGS = {
    repeatCount: 1, // 1 | 3 | 5 | 10 | "inf"
    playbackRate: 1,
    autoSkipSponsored: true, // CLAUDE.md 30장 — skip detected sponsored Shorts by default
    favoritesOnly: false, // Play only saved favorite Shorts continuously
    favoritesShuffle: true, // Randomize order when playing favorites
    panelCollapsed: false,
    panelPosition: null, // { left: number, top: number } | null (default top-right)
  };

  function isContextValid() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    } catch (_err) {
      return false;
    }
  }

  function get(key, fallback) {
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve(fallback);
        return;
      }
      try {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError || !result) {
            resolve(fallback);
            return;
          }
          resolve(result[key] !== undefined ? result[key] : fallback);
        });
      } catch (_err) {
        resolve(fallback);
      }
    });
  }

  function set(key, value) {
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve();
        return;
      }
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      } catch (_err) {
        resolve();
      }
    });
  }

  async function getSettings() {
    const stored = await get(KEYS.SETTINGS, {});
    return Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = Object.assign({}, current, partial);
    await set(KEYS.SETTINGS, next);
    return next;
  }

  async function isFavorite(videoId) {
    const favorites = await get(KEYS.FAVORITES, {});
    return Boolean(favorites[videoId]);
  }

  async function toggleFavorite(videoMeta) {
    const favorites = await get(KEYS.FAVORITES, {});
    if (favorites[videoMeta.videoId]) {
      delete favorites[videoMeta.videoId];
    } else {
      favorites[videoMeta.videoId] = Object.assign(
        { createdAt: new Date().toISOString() },
        videoMeta
      );
    }
    await set(KEYS.FAVORITES, favorites);
    return Boolean(favorites[videoMeta.videoId]);
  }

  async function getFavorites() {
    const favorites = await get(KEYS.FAVORITES, {});
    return Object.values(favorites).sort((a, b) => {
      const ta = a.createdAt || "";
      const tb = b.createdAt || "";
      return tb.localeCompare(ta);
    });
  }

  async function removeFavorite(videoId) {
    const favorites = await get(KEYS.FAVORITES, {});
    if (favorites[videoId]) {
      delete favorites[videoId];
      await set(KEYS.FAVORITES, favorites);
    }
  }

  async function getMemo(videoId) {
    const memos = await get(KEYS.MEMOS, {});
    return memos[videoId] || "";
  }

  async function getAllMemos() {
    return await get(KEYS.MEMOS, {});
  }

  async function saveMemo(videoId, text) {
    const memos = await get(KEYS.MEMOS, {});
    if (text) {
      memos[videoId] = text;
    } else {
      delete memos[videoId];
    }
    await set(KEYS.MEMOS, memos);
  }

  window.__YTW.Storage = {
    getSettings,
    saveSettings,
    isFavorite,
    toggleFavorite,
    getFavorites,
    removeFavorite,
    getMemo,
    getAllMemos,
    saveMemo,
  };
})();

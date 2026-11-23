// In-video ad skip — regular watch-page pre-roll/mid-roll ads. This is a
// separate concern from player-controller.js (Shorts-only repeat/A-B logic)
// and from the sponsored-Short detection in youtube-adapter.js (organic
// paid-promotion content). Runs on every youtube.com page.
//
// WHY THIS EXISTS (2026-09-01): the declarativeNetRequest rules in
// rules/ad-block-rules.json only block ad-decision/tracking requests
// (doubleclick.net, youtube.com/pagead/, etc.) — they deliberately do NOT
// touch googlevideo.com, because that's also where real video/audio content
// is served from and blocking it would break playback entirely. Unfortunately
// YouTube serves the actual ad video bytes through that same googlevideo.com
// CDN specifically to defeat naive domain-based blocking, so once an ad has
// been scheduled, network rules alone can't stop it from playing. This file
// is the fallback: detect an ad actually showing in the player and get
// through it as fast as possible (click Skip when available; mute + speed up
// when not).
//
// NOT verified against a live youtube.com session in this environment —
// selectors are YouTube's well-known, publicly-documented ad player class
// names, but should be confirmed and adjusted if they don't match.
(function () {
  const SETTINGS_KEY = "ytw_settings";
  let autoSkipEnabled = true;

  function loadSetting() {
    try {
      chrome.storage.local.get([SETTINGS_KEY], (result) => {
        const stored = result && result[SETTINGS_KEY];
        if (stored && typeof stored.autoSkipSponsored === "boolean") {
          autoSkipEnabled = stored.autoSkipSponsored;
        } else {
          autoSkipEnabled = true;
        }
      });
    } catch (_err) {
      // ignore if extension context invalidated
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[SETTINGS_KEY]) return;
      const next = changes[SETTINGS_KEY].newValue;
      if (next && typeof next.autoSkipSponsored === "boolean") {
        autoSkipEnabled = next.autoSkipSponsored;
        if (!autoSkipEnabled) restoreAfterAd();
      }
    });
  } catch (_err) {
    // ignore
  }

  loadSetting();

  const SKIP_BUTTON_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button",
    "button[class*='skip-ad-button']",
    ".ytp-skip-ad-button__text",
  ];

  const AD_SHOWING_SELECTORS = [
    ".html5-video-player.ad-showing",
    ".html5-video-player.ad-interrupting",
    "#movie_player.ad-showing",
    "#movie_player.ad-interrupting",
  ];

  const AD_OVERLAY_CLOSE_SELECTORS = [".ytp-ad-overlay-close-button"];

  const FAST_FORWARD_RATE = 16; // most players cap/ignore this anyway — harmless if so

  let mutedByUs = false;
  let originalRate = null;
  let loggedThisAd = false;

  function isAdShowing() {
    return AD_SHOWING_SELECTORS.some((selector) => document.querySelector(selector));
  }

  function findSkipButton() {
    for (const selector of SKIP_BUTTON_SELECTORS) {
      const btn = document.querySelector(selector);
      if (!btn) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return btn;
    }
    return null;
  }

  function findAdVideoElement() {
    return document.querySelector("#movie_player video, .html5-video-player video");
  }

  function restoreAfterAd() {
    const video = findAdVideoElement();
    if (video) {
      if (mutedByUs) {
        video.muted = false;
        mutedByUs = false;
      }
      if (originalRate !== null) {
        video.playbackRate = originalRate;
        originalRate = null;
      }
    }
    loggedThisAd = false;
  }

  function tick() {
    if (!autoSkipEnabled) {
      restoreAfterAd();
      return;
    }

    if (!isAdShowing()) {
      restoreAfterAd();
      return;
    }

    if (!loggedThisAd) {
      console.log("[YTW] ad detected on watch page");
      loggedThisAd = true;
    }

    const skipBtn = findSkipButton();
    if (skipBtn) {
      console.log("[YTW] clicking ad skip button");
      skipBtn.click();
      return;
    }

    for (const selector of AD_OVERLAY_CLOSE_SELECTORS) {
      const closeBtn = document.querySelector(selector);
      if (closeBtn) closeBtn.click();
    }

    const video = findAdVideoElement();
    if (video) {
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
      if (originalRate === null) originalRate = video.playbackRate;
      if (video.playbackRate < FAST_FORWARD_RATE) {
        video.playbackRate = FAST_FORWARD_RATE;
      }
      if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.5) {
        try {
          video.currentTime = video.duration;
        } catch (_err) {
          // ignore if seek is blocked on this ad stream
        }
      }
    }
  }

  setInterval(tick, 300);
})();

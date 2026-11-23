// YouTubeAdapter — the ONLY file allowed to know about YouTube's DOM structure
// (CLAUDE.md 23장 원칙 1: YouTube DOM 의존 최소화 / YouTubeAdapter 계층 격리).
// If YouTube changes its markup, this is the one file that needs updating.
//
// NOTE: not tested against a live browser in this environment — selectors are
// written defensively with fallbacks, but should be verified against the
// current youtube.com markup and adjusted if they stop matching.
(function () {
  window.__YTW = window.__YTW || {};

  function isShortsPage() {
    return location.pathname.startsWith("/shorts/");
  }

  function currentVideoIdFromUrl() {
    const match = location.pathname.match(/^\/shorts\/([^/?]+)/);
    return match ? match[1] : null;
  }

  // Multiple selector fallbacks covering both Desktop (www.youtube.com) and
  // Mobile (m.youtube.com / iOS Safari / Android browsers). First match wins.
  const ACTIVE_VIDEO_SELECTORS = [
    "ytd-reel-video-renderer[is-active] video.video-stream",
    "ytm-reel-video-renderer[is-active] video",
    "reel-video-in-sequence-new-view-model video",
    "ytd-shorts [is-active] video.video-stream",
    "#shorts-player video.video-stream",
    "#shorts-player video",
    "ytd-reel-video-renderer[is-active] video",
    "video.video-stream.html5-main-video",
    "video.html5-main-video",
    "video",
  ];

  function findActiveVideoElement() {
    for (const selector of ACTIVE_VIDEO_SELECTORS) {
      const candidates = document.querySelectorAll(selector);
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        // Fall back to the one that is actually playing / not paused, or the
        // one currently intersecting the viewport center.
        const playing = Array.from(candidates).find((v) => !v.paused);
        if (playing) return playing;
        const viewportCenterY = window.innerHeight / 2;
        const visible = Array.from(candidates).find((v) => {
          const rect = v.getBoundingClientRect();
          return rect.top <= viewportCenterY && rect.bottom >= viewportCenterY;
        });
        if (visible) return visible;
        return candidates[0];
      }
    }
    return null;
  }

  function isElementVisibleInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  }

  function getActiveMetaRoots() {
    const roots = [];
    const active = getActiveShortContainer();
    if (active) roots.push(active);

    // On newer desktop YouTube Shorts layouts, the bottom-left metapanel
    // (channel, title, music pill chip) may render in a sibling or separate
    // metapanel container outside ytd-reel-video-renderer[is-active].
    const extraPanels = document.querySelectorAll(
      "ytd-shorts #metapanel, ytd-shorts yt-reel-metapanel-view-model, ytd-reel-player-overlay-renderer, yt-reel-metapanel-view-model, ytd-shorts"
    );
    for (const panel of extraPanels) {
      if (roots.includes(panel)) continue;
      if (active && active.contains(panel)) continue;
      if (isElementVisibleInViewport(panel)) {
        roots.push(panel);
      }
    }
    return roots;
  }

  function queryInRoots(roots, selector) {
    for (const root of roots) {
      const el = root.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findTitleAndChannel() {
    // Best-effort metadata extraction for Favorite/Memo storage.
    const roots = getActiveMetaRoots();
    const titleEl = queryInRoots(
      roots,
      "yt-shorts-video-title-view-model, .ytShortsVideoTitleViewModelShortsVideoTitle, #title, h2"
    );
    const channelEl = queryInRoots(
      roots,
      "yt-reel-channel-bar-view-model a, .ytReelChannelBarViewModelChannelName a, ytd-channel-name a, a[href^='/@'], a[href^='/channel/']"
    );
    const fallbackTitle = document.title
      .replace(/^\(\d+\)\s*/, "")
      .replace(/\s*-\s*YouTube$/i, "")
      .trim();
    return {
      title: (titleEl && titleEl.textContent.trim()) || fallbackTitle,
      channelName: (channelEl && channelEl.textContent.trim()) || null,
      channelId: (channelEl && channelEl.getAttribute("href")) || null,
    };
  }

  function goToShortById(videoId) {
    if (!videoId) return false;
    const origin = location.origin || "https://www.youtube.com";
    const targetUrl = `${origin}/shorts/${encodeURIComponent(videoId)}`;
    console.log("[YTW] goToShortById: navigating to", targetUrl);
    window.location.assign(targetUrl);
    return true;
  }

  const MUSIC_ELEMENT_SELECTORS = [
    "reel-sound-metadata-view-model",
    "yt-reel-sound-metadata-view-model",
    "[class*='SoundMetadata']",
    "[class*='sound-metadata']",
    ".ytReelSoundMetadataViewModelMarqueeContainer",
    "a[href*='/source/']",
    "reel-pivot-button-view-model a, reel-pivot-button-view-model button",
    "yt-shorts-pivot-button-view-model a, yt-shorts-pivot-button-view-model button",
    "[class*='PivotButton'] a, [class*='PivotButton'] button",
    "#pivot-button a, #pivot-button button",
  ];

  const GENERIC_SOUND_ARIA_PATTERN =
    /^(see more videos using this sound|이 사운드로 만든 shorts.*|이 오디오로 만든 shorts.*|sound|audio|사운드|오디오|음악|music)$/i;

  const SOUND_ARIA_HINT_PATTERN =
    /(사운드|오디오|음악|노래|sound|audio|music|song)/i;

  function stripSoundBoilerplate(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\s*(이 사운드로 만든\s*Shorts.*|이 오디오로 만든\s*Shorts.*|See more videos using this sound.*)$/i, "")
      .replace(/^(사운드|오디오|음악|Sound|Audio|Music)\s*[:：-]\s*/i, "")
      .trim();
  }

  function extractCleanSoundText(el) {
    if (!el) return "";

    // Check aria-label first if it contains richer/untruncated text than a
    // truncated pill chip (e.g. "꿈꾸던 어른이 되었나요? - 머무르... 이 사운드로 만든 Shorts").
    const rawAria = (el.getAttribute("aria-label") || "").trim();
    const cleanedAria = stripSoundBoilerplate(rawAria);

    // Marquee containers often render two identical child spans for seamless
    // scrolling — grab the first non-empty attributed string if present.
    let visibleText = "";
    const innerNodes = el.querySelectorAll(
      ".yt-core-attributed-string, yt-formatted-string, span"
    );
    for (const node of innerNodes) {
      const txt = stripSoundBoilerplate(node.textContent || "");
      if (txt && !GENERIC_SOUND_ARIA_PATTERN.test(txt)) {
        visibleText = txt;
        break;
      }
    }

    if (!visibleText) {
      const rawText = stripSoundBoilerplate(el.textContent || "");
      if (rawText && !GENERIC_SOUND_ARIA_PATTERN.test(rawText)) {
        visibleText = rawText;
      }
    }

    // Collapse exact duplicated half-strings (e.g. "Song - ArtistSong - Artist").
    if (visibleText.length >= 6 && visibleText.length % 2 === 0) {
      const half = visibleText.slice(0, visibleText.length / 2);
      if (half === visibleText.slice(visibleText.length / 2)) {
        visibleText = half.trim();
      }
    }

    // Prefer non-truncated aria-label when available and not generic.
    if (
      cleanedAria &&
      !GENERIC_SOUND_ARIA_PATTERN.test(cleanedAria) &&
      (!visibleText || (visibleText.endsWith("...") && cleanedAria.length > visibleText.length))
    ) {
      return cleanedAria;
    }

    return visibleText;
  }

  function cleanMusicSearchQuery(title) {
    return String(title || "")
      .replace(/^(original sound|원본 사운드|오리지널 사운드)\s*[-·•:|]\s*/i, "")
      .replace(/\s*[·•]\s*/g, " - ")
      .replace(/\.{3,}$|…$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolveFullYouTubeUrl(href) {
    if (!href) return null;
    if (href.startsWith("http")) return href;
    return `https://www.youtube.com${href.startsWith("/") ? "" : "/"}${href}`;
  }

  function findMusicInfo() {
    const roots = getActiveMetaRoots();
    if (roots.length === 0) {
      return { title: "", searchQuery: "", sourceUrl: null, hasMusic: false };
    }

    let title = "";
    let sourceUrl = null;

    const sourceLink = queryInRoots(roots, "a[href*='/source/']");
    if (sourceLink) {
      sourceUrl = resolveFullYouTubeUrl(sourceLink.getAttribute("href"));
    }

    // Pass 1: known sound metadata & pivot button selectors.
    for (const selector of MUSIC_ELEMENT_SELECTORS) {
      const el = queryInRoots(roots, selector);
      if (!el) continue;
      const candidate = extractCleanSoundText(el);
      if (candidate) {
        title = candidate;
        if (!sourceUrl) {
          const link = el.matches("a[href]") ? el : el.querySelector("a[href]");
          if (link) sourceUrl = resolveFullYouTubeUrl(link.getAttribute("href"));
        }
        break;
      }
    }

    // Pass 2: bottom-left metapanel pill chips (e.g. "🎵 곡명 · 아티스트")
    // that may be rendered as generic buttons/links without /source/ href.
    if (!title) {
      for (const root of roots) {
        const chips = root.querySelectorAll("a, button, [role='button']");
        for (const chip of chips) {
          if (!isElementVisibleInViewport(chip)) continue;
          const aria = (chip.getAttribute("aria-label") || "").trim();
          const text = (chip.textContent || "").replace(/\s+/g, " ").trim();
          if (!text && !aria) continue;
          // Skip subscribe / channel / action buttons.
          if (/^(구독|구독중|subscribe|subscribed|좋아요|싫어요|댓글|공유|리믹스|@)/i.test(text)) {
            continue;
          }

          const hasSoundAria = SOUND_ARIA_HINT_PATTERN.test(aria);
          const hasMiddleDotMusicChip =
            (text.includes("·") || text.includes("•")) &&
            text.length >= 4 &&
            text.length <= 120 &&
            !/조회수|views|전$|ago$/i.test(text);

          if (hasSoundAria || hasMiddleDotMusicChip) {
            const candidate = extractCleanSoundText(chip);
            if (candidate && !GENERIC_SOUND_ARIA_PATTERN.test(candidate)) {
              title = candidate;
              if (!sourceUrl && chip.matches("a[href]")) {
                const href = chip.getAttribute("href");
                if (href && href.includes("/source/")) {
                  sourceUrl = resolveFullYouTubeUrl(href);
                }
              }
              break;
            }
          }
        }
        if (title) break;
      }
    }

    if (!title) {
      return { title: "", searchQuery: "", sourceUrl, hasMusic: false };
    }

    const searchQuery = cleanMusicSearchQuery(title) || title;
    return { title, searchQuery, sourceUrl, hasMusic: true };
  }

  // YouTube's SPA fires this custom event on document after client-side
  // navigation completes (a widely-documented, publicly-known technique for
  // detecting YT route changes — not copied from any specific extension).
  function onNavigate(callback) {
    const safeCallback = () => {
      try {
        if (!chrome || !chrome.runtime || !chrome.runtime.id) {
          clearInterval(pollId);
          document.removeEventListener("yt-navigate-finish", safeCallback);
          return;
        }
      } catch (_err) {
        clearInterval(pollId);
        document.removeEventListener("yt-navigate-finish", safeCallback);
        return;
      }
      callback();
    };
    document.addEventListener("yt-navigate-finish", safeCallback);
    window.addEventListener("popstate", safeCallback);
    // Safety-net poll in case yt-navigate-finish is missed on some
    // versions/timings (including m.youtube.com mobile SPA).
    const pollId = setInterval(safeCallback, 800);
  }

  // Best-effort "advance to the next Shorts video," used when a finite
  // repeat count runs out (CLAUDE.md 6장: 다음 Short로 넘어감).
  // There is no public API for this, so we try a few strategies in order and
  // stop at the first one that finds something to act on. NOT verified
  // against a live youtube.com session in this environment — if none of
  // these still match current markup, this silently does nothing and the
  // video just stays on its last frame (same as before this feature existed).
  const NEXT_BUTTON_SELECTORS = [
    "#navigation-button-down button",
    "ytd-shorts #navigation-button-down button",
    "button[aria-label*='Next video']",
    "button[aria-label*='다음 동영상']",
  ];

  function goToNextShort() {
    for (const selector of NEXT_BUTTON_SELECTORS) {
      const btn = document.querySelector(selector);
      if (btn) {
        console.log("[YTW] goToNextShort: clicking next button via selector", selector);
        btn.click();
        return true;
      }
    }
    console.log("[YTW] goToNextShort: no next button matched", NEXT_BUTTON_SELECTORS);

    // Fallback: YouTube Shorts also responds to ArrowDown to advance. Synthetic
    // (non-trusted) KeyboardEvents aren't guaranteed to be honored by every
    // site, but many keydown listeners don't check event.isTrusted.
    const target = findActiveVideoElement() || document.body;
    console.log("[YTW] goToNextShort: dispatching ArrowDown as fallback");
    ["keydown", "keyup"].forEach((type) => {
      target.dispatchEvent(
        new KeyboardEvent(type, {
          key: "ArrowDown",
          code: "ArrowDown",
          keyCode: 40,
          which: 40,
          bubbles: true,
        })
      );
    });

    // Last resort: the Shorts feed is a snap-scrolling container — scrolling
    // it by one viewport height approximates a manual swipe (works on m.youtube.com too).
    const container = document.querySelector(
      "#shorts-container, ytd-shorts #contents, .reel-video-in-sequence, ytm-shorts, #reel-video-renderer-container"
    );
    if (container && container.scrollHeight > container.clientHeight + 20) {
      console.log("[YTW] goToNextShort: scrolling container as last resort", container);
      container.scrollBy({ top: window.innerHeight, behavior: "smooth" });
      return true;
    }
    if (document.scrollingElement && document.scrollingElement.scrollHeight > window.innerHeight + 20) {
      console.log("[YTW] goToNextShort: scrolling window as mobile fallback");
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
      return true;
    }
    console.log("[YTW] goToNextShort: no scroll container found either — giving up");
    return false;
  }

  // Best-effort sponsored/ad detection (CLAUDE.md 30장, reduced scope: just
  // enough signal to auto-skip, no separate "Sponsored" category feed yet —
  // that needs the Discovery Collector from Phase 4.5, not built).
  // NOT verified against a live youtube.com session — badge/ad-slot markup
  // in particular is guesswork until confirmed against real Shorts.
  //
  // BUG FIXED (2026-09-01, reported: normal Shorts getting auto-skipped in
  // batches of 4-5): the original selectors here were not scoped to the
  // currently-active Short. "ytd-shorts ytd-ad-slot-renderer" in particular
  // matched an ad-slot element ANYWHERE in the loaded feed (including
  // preloaded neighboring items, or a home-feed ad sitting underneath a
  // Shorts overlay) — not one actually belonging to the video on screen. And
  // the badge check only looked for the generic <ytd-badge-supported-renderer>
  // tag, which YouTube reuses for unrelated badges (4K, LIVE, etc.), so any
  // badge at all was enough to misfire. Every check below is now scoped to a
  // container we've confirmed is the active Short, and badges require actual
  // matching disclosure text rather than just tag presence.
  function getActiveShortContainer() {
    return (
      document.querySelector("ytd-reel-video-renderer[is-active]") ||
      document.querySelector("ytm-reel-video-renderer[is-active]") ||
      document.querySelector("ytd-shorts [is-active]") ||
      document.querySelector("reel-video-in-sequence-new-view-model")
    );
  }

  const AD_SLOT_SELECTORS = [
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-display-ad-renderer",
    "ad-badge-view-model",
    "ad-avatar-lockup-view-model",
    "ad-button-view-model",
    "yt-shorts-ad-overlay",
    "[class*='AdBadge']",
    "[class*='ad-badge']",
    "[class*='AdAvatarLockup']",
    "[class*='ad-avatar-lockup']",
  ];

  // Exact standalone badge labels (e.g. "스폰서", "광고", "Sponsored", "Ad")
  const EXACT_AD_BADGE_PATTERN = /^(스폰서|광고|sponsored|ad|유료\s*광고|유료\s*프로모션|협찬)$/i;

  // Disclosure phrases appearing inside overlays / badges / aria-labels
  const DISCLOSURE_TEXT_PATTERN =
    /(paid promotion|includes paid promotion|sponsored|스폰서|유료\s*프로모션|유료\s*광고|광고\s*포함|협찬|간접\s*광고)/i;

  // Title keywords — kept specific so ordinary videos mentioning "광고" in a
  // normal sentence (e.g. "웃긴 광고 모음") aren't false-positived.
  const AD_KEYWORD_PATTERN =
    /(#ad\b|#sponsored\b|\bsponsored\b|#광고|#스폰서|\[광고\]|\(광고\)|\[스폰서\]|\(스폰서\)|유료\s*광고|유료\s*프로모션|협찬|제공받아)/i;

  const BADGE_CANDIDATE_SELECTORS = [
    "ad-badge-view-model",
    "ad-avatar-lockup-view-model span",
    "yt-badge-view-model",
    "badge-shape",
    ".yt-badge-shape__text",
    "ytd-badge-supported-renderer",
    ".ytp-paid-content-overlay",
    ".ytp-paid-content-overlay-text",
    "[class*='paid-content']",
    "[class*='PaidContent']",
    "[class*='ad-badge']",
    "[class*='AdBadge']",
    "ytd-reel-player-overlay-renderer span",
    "#overlay span",
    "[aria-label]",
  ].join(", ");

  function isElementOwnedByActiveShort(el) {
    if (!el) return false;
    if (el.closest && el.closest("#ytw-panel-host")) return false;
    const parentReel = el.closest && el.closest("ytd-reel-video-renderer");
    if (parentReel && !parentReel.hasAttribute("is-active")) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const centerY = (rect.top + rect.bottom) / 2;
    return centerY >= 40 && centerY <= window.innerHeight - 10;
  }

  function getActiveAdRoots() {
    const roots = [];
    const active = getActiveShortContainer();
    if (active) roots.push(active);

    // Shorts in-feed ads (e.g. "스폰서" + "사이트 방문" card) can render as a
    // sibling ytd-ad-slot-renderer or overlay outside ytd-reel-video-renderer[is-active].
    const panels = document.querySelectorAll(
      "ytd-shorts ytd-ad-slot-renderer, ytd-shorts #metapanel, ytd-shorts yt-reel-metapanel-view-model, yt-reel-metapanel-view-model, ytd-reel-player-overlay-renderer"
    );
    for (const panel of panels) {
      if (roots.includes(panel)) continue;
      if (active && active.contains(panel)) continue;
      if (isElementOwnedByActiveShort(panel)) {
        roots.push(panel);
      }
    }
    return roots;
  }

  function isSponsoredShort() {
    const signals = [];
    const container = getActiveShortContainer();
    const roots = getActiveAdRoots();

    // 1. Direct player ad state on the active Short.
    if (
      container &&
      container.querySelector(".html5-video-player.ad-showing, .html5-video-player.ad-interrupting")
    ) {
      signals.push("player_ad_showing");
    }

    // 2. Visible platform ad slots / ad badge elements strictly on the active Short.
    for (const root of roots) {
      for (const selector of AD_SLOT_SELECTORS) {
        if (root.matches && root.matches(selector) && isElementOwnedByActiveShort(root)) {
          signals.push("platform_ad_slot:" + selector);
          break;
        }
        const slots = root.querySelectorAll(selector);
        for (const slot of slots) {
          if (isElementOwnedByActiveShort(slot)) {
            signals.push("platform_ad_slot:" + selector);
            break;
          }
        }
        if (signals.length > 0) break;
      }
      if (signals.length > 0) break;
    }

    // 3. Visible badge / disclosure text strictly on the active Short.
    if (signals.length === 0) {
      for (const root of roots) {
        const badgeCandidates = root.querySelectorAll(BADGE_CANDIDATE_SELECTORS);
        for (const el of badgeCandidates) {
          if (!isElementOwnedByActiveShort(el)) continue;
          const ownText = (el.textContent || "").replace(/\s+/g, " ").trim();
          const aria = (el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();

          if (ownText && ownText.length <= 60 && EXACT_AD_BADGE_PATTERN.test(ownText)) {
            signals.push("ad_badge:" + ownText);
            break;
          }

          const combined = `${ownText} ${aria}`.trim();
          if (combined && combined.length <= 160 && DISCLOSURE_TEXT_PATTERN.test(combined)) {
            signals.push("disclosure_badge:" + combined.slice(0, 40));
            break;
          }
        }
        if (signals.length > 0) break;
      }
    }

    // 4. Title-level sponsored/ad tags.
    const meta = findTitleAndChannel();
    const match = (meta.title || "").match(AD_KEYWORD_PATTERN);
    if (match) signals.push("keyword:" + match[0]);

    return { isAd: signals.length > 0, signals };
  }

  window.__YTW.Adapter = {
    isShortsPage,
    currentVideoIdFromUrl,
    findActiveVideoElement,
    findTitleAndChannel,
    findMusicInfo,
    onNavigate,
    goToNextShort,
    goToShortById,
    isSponsoredShort,
  };
})();

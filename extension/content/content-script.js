// Entry point: wires Adapter + PlayerController + Storage + FloatingPanel
// together, and bridges state/commands with the optional detached popup window.
(function () {
  const { Adapter, Storage, createPlayerController, createFloatingPanel } = window.__YTW;

  const controller = createPlayerController();

  let lastVideoId = null;
  let lastVideoEl = null;
  let currentVideoMeta = null;
  let cachedServerMusic = null; // { videoId, title, searchQuery, sourceUrl, hasMusic }
  let detachedPendingA = null;
  let isDetached = false;
  let retryTimer = null;
  let adRecheckTimers = [];
  let lastSkippedKey = null;
  let lastSkippedAt = 0;
  let lastTimePushAt = 0;

  const panel = createFloatingPanel({
    controller,
    storage: Storage,
    onSelectFavorite: (videoId) => {
      Adapter.goToShortById(videoId);
    },
    getMusicInfo: () => Adapter.findMusicInfo(),
    onRefreshMusic: () => {
      if (currentVideoMeta && currentVideoMeta.videoId) {
        cachedServerMusic = null;
        enrichMusicFromServer(currentVideoMeta.videoId, true);
      }
    },
    onDetach: () => {
      try {
        chrome.runtime.sendMessage({ type: "YTW_OPEN_DETACHED" }, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn("[YTW] detach failed (runtime):", err.message);
            panel.showNotice("창 분리 실패: 확장 새로고침 후 YouTube 탭도 F5로 새로고침해 주세요");
            return;
          }
          if (!res || !res.ok) {
            console.warn("[YTW] detach failed:", res && res.error);
            panel.showNotice(`창 분리 실패 (${(res && res.error) || "unknown"})`);
          }
        });
      } catch (e) {
        console.warn("[YTW] detach exception:", e);
        panel.showNotice("확장이 갱신되었습니다 — YouTube 탭을 새로고침(F5) 후 다시 눌러주세요");
      }
    },
  });

  function getBestMusicInfo(videoId) {
    const domMusic = Adapter.isShortsPage()
      ? Adapter.findMusicInfo()
      : { title: "", searchQuery: "", sourceUrl: null, songVideoId: null, hasMusic: false };

    if (cachedServerMusic && cachedServerMusic.videoId === videoId && cachedServerMusic.hasMusic) {
      return {
        title: cachedServerMusic.title || domMusic.title,
        searchQuery: cachedServerMusic.searchQuery || domMusic.searchQuery,
        sourceUrl: cachedServerMusic.sourceUrl || domMusic.sourceUrl,
        songVideoId: cachedServerMusic.songVideoId || null,
        hasMusic: true,
      };
    }
    return Object.assign({ songVideoId: null }, domMusic);
  }

  let musicFetchInFlightId = null;

  function enrichMusicFromServer(videoId, force = false) {
    if (!videoId) return;
    if (!force && cachedServerMusic && cachedServerMusic.videoId === videoId) return;
    if (!force && musicFetchInFlightId === videoId) return;

    musicFetchInFlightId = videoId;
    const domMusic = Adapter.findMusicInfo();

    chrome.runtime.sendMessage({ type: "YTW_FETCH_MUSIC_META", videoId }, (res) => {
      void chrome.runtime.lastError;
      if (musicFetchInFlightId === videoId) musicFetchInFlightId = null;
      if (!currentVideoMeta || currentVideoMeta.videoId !== videoId) return;
      if (!res || !res.ok || !res.title) return;

      cachedServerMusic = {
        videoId,
        title: res.title,
        searchQuery: res.searchQuery || res.title,
        sourceUrl: res.sourceUrl || domMusic.sourceUrl || null,
        songVideoId: res.songVideoId || null,
        hasMusic: true,
      };
      panel.setMusicInfo(cachedServerMusic);
      pushStateToDetached();
    });
  }

  async function buildStateSnapshot() {
    const settings = await Storage.getSettings();
    const favorites = await Storage.getFavorites();
    const memos = await Storage.getAllMemos();
    const videoId = currentVideoMeta ? currentVideoMeta.videoId : Adapter.currentVideoIdFromUrl();
    const isFav = videoId ? await Storage.isFavorite(videoId) : false;
    const memo = videoId ? await Storage.getMemo(videoId) : "";
    const music = getBestMusicInfo(videoId);

    return {
      isShortsPage: Adapter.isShortsPage(),
      videoMeta: currentVideoMeta,
      playerState: controller.getState(),
      pendingA: detachedPendingA,
      settings,
      isFav,
      memo,
      favorites,
      memos,
      music,
    };
  }

  function pushStateToDetached() {
    if (!isDetached) return;
    buildStateSnapshot()
      .then((snapshot) => {
        chrome.runtime.sendMessage({ type: "YTW_STATE_PUSH", snapshot }, () => {
          void chrome.runtime.lastError;
        });
      })
      .catch(() => { });
  }

  controller.onChange((state) => {
    panel.updatePlayerState(state);
    pushStateToDetached();
  });

  controller.onTime((sec) => {
    panel.updateCurrentTime(sec);
    if (isDetached) {
      const now = Date.now();
      if (now - lastTimePushAt >= 200) {
        lastTimePushAt = now;
        chrome.runtime.sendMessage({ type: "YTW_TIME_PUSH", currentTime: sec }, () => {
          void chrome.runtime.lastError;
        });
      }
    }
  });

  controller.onTime((sec) => {
    panel.updateCurrentTime(sec);
  });

  async function advanceToNextShort() {
    const settings = await Storage.getSettings();
    if (settings.favoritesOnly) {
      const favorites = await Storage.getFavorites();
      if (favorites.length > 0) {
        const currentId = Adapter.currentVideoIdFromUrl();
        let nextFav = null;

        if (favorites.length === 1) {
          nextFav = favorites[0];
        } else if (settings.favoritesShuffle !== false) {
          const candidates = favorites.filter((f) => f.videoId !== currentId);
          const pool = candidates.length > 0 ? candidates : favorites;
          nextFav = pool[Math.floor(Math.random() * pool.length)];
        } else {
          const idx = favorites.findIndex((f) => f.videoId === currentId);
          nextFav = favorites[(idx + 1) % favorites.length];
        }

        if (nextFav && nextFav.videoId) {
          if (nextFav.videoId === currentId) {
            // Single favorite in list: restart it instead of reloading the same URL.
            const videoEl = Adapter.findActiveVideoElement();
            if (videoEl) {
              videoEl.currentTime = 0;
              videoEl.play().catch(() => { });
              controller.setRepeatCount(
                settings.repeatCount === "inf" ? Infinity : settings.repeatCount
              );
              return;
            }
          }
          Adapter.goToShortById(nextFav.videoId);
          return;
        }
      }
    }

    Adapter.goToNextShort();
  }

  // Finite repeat count used up (6장) -> move on instead of just stopping.
  // "Infinity" repeats never fires this, so it keeps looping the same video.
  controller.onExhausted(() => {
    advanceToNextShort();
  });

  async function handleDetachedCommand(command, payload) {
    switch (command) {
      case "GET_STATE":
        return { ok: true, snapshot: await buildStateSnapshot() };

      case "SET_REPEAT": {
        const raw = payload && payload.value;
        const repeatVal = raw === "inf" ? Infinity : Number(raw);
        controller.setRepeatCount(repeatVal);
        const settings = await Storage.saveSettings({
          repeatCount: repeatVal === Infinity ? "inf" : repeatVal,
        });
        await panel.syncExternalState(settings);
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_SPEED": {
        const rate = Number(payload && payload.value) || 1;
        controller.setPlaybackRate(rate);
        const settings = await Storage.saveSettings({ playbackRate: rate });
        await panel.syncExternalState(settings);
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_A": {
        detachedPendingA = controller.getCurrentTime();
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_B": {
        if (detachedPendingA !== null) {
          const b = controller.getCurrentTime();
          controller.setABLoop(detachedPendingA, b, 5);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "CLEAR_AB": {
        detachedPendingA = null;
        controller.clearABLoop();
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "TOGGLE_FAV": {
        if (currentVideoMeta) {
          const isFav = await Storage.toggleFavorite(currentVideoMeta);
          const settings = await Storage.getSettings();
          await panel.syncExternalState(settings, isFav);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "REMOVE_FAV": {
        if (payload && payload.videoId) {
          await Storage.removeFavorite(payload.videoId);
          const settings = await Storage.getSettings();
          const isFav = currentVideoMeta
            ? await Storage.isFavorite(currentVideoMeta.videoId)
            : false;
          await panel.syncExternalState(settings, isFav);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SAVE_MEMO": {
        if (currentVideoMeta) {
          const text = (payload && payload.text) || "";
          await Storage.saveMemo(currentVideoMeta.videoId, text);
          const settings = await Storage.getSettings();
          await panel.syncExternalState(settings, undefined, text);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_FAV_ONLY": {
        const settings = await Storage.saveSettings({
          favoritesOnly: Boolean(payload && payload.value),
        });
        await panel.syncExternalState(settings);
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_FAV_SHUFFLE": {
        const settings = await Storage.saveSettings({
          favoritesShuffle: Boolean(payload && payload.value),
        });
        await panel.syncExternalState(settings);
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SET_AUTO_SKIP": {
        const enabled = Boolean(payload && payload.value);
        const settings = await Storage.saveSettings({
          autoSkipSponsored: enabled,
        });
        await panel.syncExternalState(settings);
        if (enabled && currentVideoMeta && currentVideoMeta.videoId) {
          trySkipSponsoredNow(currentVideoMeta.videoId, settings);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      case "SELECT_FAV": {
        if (payload && payload.videoId) {
          Adapter.goToShortById(payload.videoId);
        }
        return { ok: true };
      }

      case "NEXT_SHORT": {
        await advanceToNextShort();
        return { ok: true };
      }

      case "REFRESH_MUSIC": {
        if (currentVideoMeta && currentVideoMeta.videoId) {
          cachedServerMusic = null;
          enrichMusicFromServer(currentVideoMeta.videoId);
        }
        return { ok: true, snapshot: await buildStateSnapshot() };
      }

      default:
        return { ok: false, error: "unknown_command" };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === "YTW_DETACHED_STATUS") {
      isDetached = Boolean(message.detached);
      panel.setDetachedMode(isDetached);
      if (isDetached) {
        pushStateToDetached();
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "YTW_TAB_CMD") {
      handleDetachedCommand(message.command, message.payload)
        .then((res) => sendResponse(res))
        .catch((err) => {
          sendResponse({ ok: false, error: err && err.message ? err.message : "cmd_failed" });
        });
      return true;
    }

    return false;
  });

  function clearAdRecheckTimers() {
    adRecheckTimers.forEach((id) => clearTimeout(id));
    adRecheckTimers = [];
  }

  function trySkipSponsoredNow(videoId, settings, { allowDuringCooldown = false } = {}) {
    if (!Adapter.isShortsPage()) return false;
    if (videoId && Adapter.currentVideoIdFromUrl() !== videoId) return false;
    if (!settings || !settings.autoSkipSponsored) return false;

    const now = Date.now();
    // After skipping a sponsored Short, wait for the scroll transition to settle
    // so the outgoing ad's DOM never triggers a false skip on the next normal Short.
    if (!allowDuringCooldown && now - lastSkippedAt < 1400) {
      return false;
    }

    const adCheck = Adapter.isSponsoredShort();
    if (!adCheck.isAd) return false;

    const skipKey = `${videoId || "ad"}::${adCheck.signals.join(",")}`;
    if (skipKey === lastSkippedKey && now - lastSkippedAt < 3000) {
      return true;
    }

    lastSkippedKey = skipKey;
    lastSkippedAt = now;
    console.log("[YTW] sponsored/ad Short detected - auto-skipping", adCheck.signals);
    clearAdRecheckTimers();
    controller.detach();
    panel.notifySponsorSkipped(adCheck.signals);
    Adapter.goToNextShort();
    return true;
  }

  async function syncToCurrentVideo() {
    if (!Adapter.isShortsPage()) {
      clearAdRecheckTimers();
      panel.unmount();
      controller.detach();
      lastVideoId = null;
      lastVideoEl = null;
      currentVideoMeta = null;
      detachedPendingA = null;
      pushStateToDetached();
      return;
    }

    const videoId = Adapter.currentVideoIdFromUrl();
    const videoEl = Adapter.findActiveVideoElement();

    if (!videoEl) {
      // Shorts page loaded but the player DOM isn't ready yet — retry shortly
      // instead of failing silently (common right after yt-navigate-finish).
      clearTimeout(retryTimer);
      retryTimer = setTimeout(syncToCurrentVideo, 300);
      return;
    }

    if (videoEl === lastVideoEl && videoId === lastVideoId) {
      // Shorts in-feed ads often reuse both the <video> element AND the
      // previous URL's videoId. Still run sponsored/ad check on the poll tick
      // so newly scrolled-in in-feed ads are caught and skipped!
      const pollSettings = await Storage.getSettings();
      if (pollSettings.autoSkipSponsored) {
        trySkipSponsoredNow(videoId, pollSettings);
      }
      return; // already attached to this exact video
    }
    console.log("[YTW] video changed", { from: lastVideoId, to: videoId, sameElement: videoEl === lastVideoEl });
    clearAdRecheckTimers();
    lastVideoId = videoId;
    lastVideoEl = videoEl;
    cachedServerMusic = null;
    detachedPendingA = null;

    const settings = await Storage.getSettings();
    if (trySkipSponsoredNow(videoId, settings)) {
      return;
    }

    controller.attachTo(videoEl);

    const meta = Adapter.findTitleAndChannel();
    currentVideoMeta = {
      videoId,
      title: meta.title,
      channelName: meta.channelName,
      channelId: meta.channelId,
      url: location.href,
    };

    await panel.onVideoChanged(currentVideoMeta, settings);
    pushStateToDetached();
    enrichMusicFromServer(videoId);

    // Re-check for late-rendered "스폰서" / "광고" / "유료 프로모션" badges
    // (1600ms also runs cleanly after the 1400ms post-skip transition cooldown).
    if (settings.autoSkipSponsored) {
      [700, 1600].forEach((delayMs) => {
        const tid = setTimeout(async () => {
          if (!currentVideoMeta || currentVideoMeta.videoId !== videoId) return;
          const latest = await Storage.getSettings();
          trySkipSponsoredNow(videoId, latest);
        }, delayMs);
        adRecheckTimers.push(tid);
      });
    }

    // Push once more shortly after so late-rendered music/sound metadata reaches
    // the detached window automatically.
    setTimeout(() => {
      if (currentVideoMeta && currentVideoMeta.videoId === videoId) {
        pushStateToDetached();
        enrichMusicFromServer(videoId);
      }
    }, 750);
  }

  // Check if a detached window is already open (e.g. after a Short navigation reload).
  chrome.runtime.sendMessage({ type: "YTW_GET_DETACHED_STATUS" }, (res) => {
    void chrome.runtime.lastError;
    if (res && res.detached) {
      isDetached = true;
      panel.setDetachedMode(true);
      pushStateToDetached();
    }
  });

  Adapter.onNavigate(syncToCurrentVideo);
  syncToCurrentVideo();
})();

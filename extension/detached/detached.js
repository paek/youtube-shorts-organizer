// Detached popup window controller — mirrors YT Organizer outside the main
// browser window and relays commands/state with the YouTube Shorts tab via
// the background service worker.
(function () {
  const REPEAT_OPTIONS = [1, 3, 5, 10, "inf"];
  const SPEED_OPTIONS = [0.5, 0.75, 0.8, 1, 1.25, 1.5, 2];

  const params = new URLSearchParams(location.search);
  const rawTabId = params.get("tabId");
  const targetTabId = rawTabId && /^\d+$/.test(rawTabId) ? Number(rawTabId) : null;

  let currentSnapshot = null;
  let lastVideoId = null;
  let currentMusicTranslation = "";
  let currentLyricsTranslation = "";
  let captionSegments = [];
  let lastCaptionIdx = -1;
  let memoStatusTimer = null;

  const $ = (id) => document.getElementById(id);

  function relayToTab(command, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "YTW_RELAY_TO_TAB", tabId: targetTabId, command, payload },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false });
        }
      );
    });
  }

  function buildStaticButtons() {
    const repeatRow = $("repeat-row");
    REPEAT_OPTIONS.forEach((value) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = String(value);
      btn.textContent = value === "inf" ? "∞" : String(value);
      btn.addEventListener("click", async () => {
        const res = await relayToTab("SET_REPEAT", { value });
        if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
      });
      repeatRow.appendChild(btn);
    });

    const speedRow = $("speed-row");
    SPEED_OPTIONS.forEach((value) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = String(value);
      btn.textContent = `${value}x`;
      btn.addEventListener("click", async () => {
        const res = await relayToTab("SET_SPEED", { value });
        if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
      });
      speedRow.appendChild(btn);
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("ytw-tab-active", btn.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll("[data-pane]").forEach((pane) => {
      pane.classList.toggle("ytw-tab-active", pane.getAttribute("data-pane") === tabName);
    });
  }

  function setLyricsStatus(msg) {
    $("lyrics-status").textContent = msg || "";
  }

  function clearMusicAndLyrics() {
    currentMusicTranslation = "";
    currentLyricsTranslation = "";
    captionSegments = [];
    lastCaptionIdx = -1;

    const mt = $("music-translation");
    mt.textContent = "";
    mt.classList.remove("ytw-visible");

    setLyricsStatus("");
    $("lyrics-input").value = "";
    const lt = $("lyrics-translated");
    lt.textContent = "";
    lt.classList.remove("ytw-visible");
    $("lyrics-actions").classList.add("ytw-btn-hidden");

    $("live-caption").classList.remove("ytw-visible");
    $("live-caption-orig").textContent = "";
    $("live-caption-ko").textContent = "";
  }

  function updateCurrentTime(currentTimeSec) {
    if (captionSegments.length === 0) return;
    const idx = captionSegments.findIndex(
      (seg) => currentTimeSec >= seg.startSec && currentTimeSec <= seg.endSec
    );
    if (idx === lastCaptionIdx) return;
    lastCaptionIdx = idx;

    if (idx === -1) {
      $("live-caption-orig").textContent = "";
      $("live-caption-ko").textContent = "";
      return;
    }

    const seg = captionSegments[idx];
    $("live-caption-orig").textContent = seg.text || "";
    $("live-caption-ko").textContent = seg.translated || "";
  }

  function getEffectiveMusicTitle() {
    const typed = $("music-title").value.trim();
    if (typed) return typed;
    return (currentSnapshot && currentSnapshot.music && currentSnapshot.music.title) || "";
  }

  function getEffectiveMusicQuery() {
    const typed = $("music-title").value.trim();
    if (typed) {
      return (
        typed
          .replace(/^(original sound|원본 사운드|오리지널 사운드)\s*[-·:|]\s*/i, "")
          .trim() || typed
      );
    }
    return (currentSnapshot && currentSnapshot.music && currentSnapshot.music.searchQuery) || "";
  }

  function renderFavorites(favorites, memos, activeId) {
    const list = Array.isArray(favorites) ? favorites : [];
    const memoMap = memos || {};

    $("fav-list-label").textContent = `★ 즐겨찾기 목록 (${list.length})`;
    $("tab-favorites").textContent = `★ 즐겨찾기 (${list.length})`;

    const listEl = $("fav-list");
    listEl.textContent = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ytw-fav-empty";
      empty.textContent = "저장된 즐겨찾기가 없습니다.";
      listEl.appendChild(empty);
      return;
    }

    list.forEach((fav) => {
      const item = document.createElement("div");
      item.className = "ytw-fav-item";
      if (fav.videoId === activeId) item.classList.add("ytw-current");

      const main = document.createElement("div");
      main.className = "ytw-fav-item-main";
      main.title = fav.title || fav.videoId;
      main.addEventListener("click", () => {
        relayToTab("SELECT_FAV", { videoId: fav.videoId });
      });

      const titleEl = document.createElement("div");
      titleEl.className = "ytw-fav-item-title";
      titleEl.textContent = `${memoMap[fav.videoId] ? "📝 " : ""}${fav.title || fav.videoId}`;

      const subEl = document.createElement("div");
      subEl.className = "ytw-fav-item-sub";
      subEl.textContent = fav.channelName || fav.videoId;

      main.appendChild(titleEl);
      main.appendChild(subEl);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "ytw-fav-del";
      delBtn.textContent = "✕";
      delBtn.title = "즐겨찾기에서 제거";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const res = await relayToTab("REMOVE_FAV", { videoId: fav.videoId });
        if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
      });

      item.appendChild(main);
      item.appendChild(delBtn);
      listEl.appendChild(item);
    });
  }

  function renderSnapshot(snapshot) {
    if (!snapshot) return;
    currentSnapshot = snapshot;

    const connected = Boolean(snapshot.isShortsPage && snapshot.videoMeta);
    $("conn-dot").classList.toggle("ytw-connected", connected);

    const videoMeta = snapshot.videoMeta;
    const videoId = videoMeta ? videoMeta.videoId : null;
    const videoChanged = videoId !== lastVideoId;
    if (videoChanged) {
      lastVideoId = videoId;
      clearMusicAndLyrics();
    }

    if (connected) {
      $("now-title").textContent = videoMeta.title || videoMeta.videoId;
      $("now-sub").textContent = videoMeta.channelName || "YouTube Shorts";
    } else {
      $("now-title").textContent = "YouTube Shorts 페이지를 열어주세요";
      $("now-sub").textContent = "Shorts 재생 시 자동으로 연결됩니다";
    }

    const ps = snapshot.playerState || { repeatCount: 1, repeatIndex: 0, abLoop: null };
    $("repeat-progress").textContent =
      ps.repeatCount === null || ps.repeatCount === Infinity
        ? `${ps.repeatIndex + 1}/∞`
        : `${ps.repeatIndex + 1}/${ps.repeatCount}`;

    const aStr = snapshot.pendingA !== null && snapshot.pendingA !== undefined
      ? Number(snapshot.pendingA).toFixed(2)
      : "--";
    const bStr = ps.abLoop ? Number(ps.abLoop.end).toFixed(2) : "--";
    $("ab-status").textContent = `A: ${aStr} / B: ${bStr}`;

    const settings = snapshot.settings || {};
    const activeRepeat = String(settings.repeatCount === "inf" ? "inf" : settings.repeatCount || 1);
    Array.from($("repeat-row").children).forEach((btn) => {
      btn.classList.toggle("ytw-active", btn.dataset.value === activeRepeat);
    });

    const activeSpeed = String(settings.playbackRate || 1);
    Array.from($("speed-row").children).forEach((btn) => {
      btn.classList.toggle("ytw-active", btn.dataset.value === activeSpeed);
    });

    const favBtn = $("fav-btn");
    favBtn.classList.toggle("ytw-is-fav", Boolean(snapshot.isFav));
    favBtn.textContent = snapshot.isFav ? "★ 즐겨찾기됨" : "☆ 즐겨찾기 추가";

    $("favorites-only").checked = Boolean(settings.favoritesOnly);
    $("favorites-order").textContent = settings.favoritesShuffle !== false ? "랜덤" : "순서";
    $("auto-skip-sponsored").checked = Boolean(settings.autoSkipSponsored);

    if (videoChanged || document.activeElement !== $("memo")) {
      $("memo").value = snapshot.memo || "";
    }

    const music = snapshot.music || {};
    if (
      (videoChanged ||
        !$("music-title").value.trim() ||
        $("music-title").value.endsWith("...") ||
        $("music-title").value.endsWith("…")) &&
      document.activeElement !== $("music-title") &&
      music.title
    ) {
      $("music-title").value = music.title;
    } else if (videoChanged && document.activeElement !== $("music-title")) {
      $("music-title").value = music.title || "";
    }
    $("music-source").classList.toggle("ytw-btn-hidden", !music.sourceUrl);

    renderFavorites(snapshot.favorites, snapshot.memos, videoId);
  }

  function showMemoStatus(msg) {
    $("memo-status").textContent = msg;
    clearTimeout(memoStatusTimer);
    memoStatusTimer = setTimeout(() => {
      $("memo-status").textContent = "";
    }, 2000);
  }

  async function saveMemo() {
    const text = $("memo").value;
    const res = await relayToTab("SAVE_MEMO", { text });
    if (res.ok && res.snapshot) {
      renderSnapshot(res.snapshot);
      showMemoStatus(text ? "저장됨 ✓" : "메모 삭제됨");
    }
  }

  function translateMusicTitle() {
    const text = getEffectiveMusicQuery();
    const box = $("music-translation");
    if (!text) return;

    box.textContent = "번역 중...";
    box.classList.add("ytw-visible");

    chrome.runtime.sendMessage({ type: "YTW_TRANSLATE", text, targetLang: "auto" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        currentMusicTranslation = "";
        box.textContent = "자동 번역 실패";
        return;
      }
      currentMusicTranslation = response.translatedText || "";
      box.textContent = "";
      const langTag = document.createElement("span");
      langTag.className = "ytw-music-lang";
      langTag.textContent = `[${response.sourceLang}→${response.targetLang}]`;
      box.appendChild(langTag);
      box.appendChild(document.createTextNode(currentMusicTranslation));
    });
  }

  function fetchCaptions() {
    const videoId = currentSnapshot && currentSnapshot.videoMeta && currentSnapshot.videoMeta.videoId;
    if (!videoId) {
      setLyricsStatus("연결된 쇼츠 영상이 없습니다.");
      return;
    }

    setLyricsStatus("YouTube 자막 추출 중...");
    chrome.runtime.sendMessage({ type: "YTW_FETCH_CAPTIONS", videoId }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        captionSegments = [];
        lastCaptionIdx = -1;
        $("live-caption").classList.remove("ytw-visible");
        setLyricsStatus(
          "이 쇼츠에는 YouTube 자막 트랙이 없습니다. Chrome 실시간 자막(chrome://settings/captions)을 켜거나 직접 입력해 번역하세요."
        );
        return;
      }

      captionSegments = response.segments.map((s) => ({
        startSec: s.startSec,
        endSec: s.endSec,
        text: s.text,
        translated: "",
      }));
      lastCaptionIdx = -1;
      $("lyrics-input").value = captionSegments.map((s) => s.text).join("\n");
      $("live-caption").classList.add("ytw-visible");
      const autoLabel = response.isAutoGenerated ? "자동 생성" : "수동";
      setLyricsStatus(
        `자막 로드됨 (${response.languageCode}, ${autoLabel}, ${captionSegments.length}줄) — 전체 번역을 누르면 실시간 한글 자막도 표시됩니다.`
      );
    });
  }

  function fetchLyrics() {
    const query = getEffectiveMusicQuery();
    if (!query) {
      setLyricsStatus("곡 제목을 먼저 입력하거나 확인해 주세요.");
      return;
    }

    setLyricsStatus("가사 검색 중...");
    chrome.runtime.sendMessage({ type: "YTW_FETCH_LYRICS", query }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        setLyricsStatus("자동 가사 없음 — 🔍 웹검색으로 찾거나 직접 붙여넣어 번역하세요.");
        return;
      }
      captionSegments = [];
      lastCaptionIdx = -1;
      $("live-caption").classList.remove("ytw-visible");
      $("lyrics-input").value = response.lyrics || "";
      const matched = [response.artistName, response.trackName].filter(Boolean).join(" - ");
      setLyricsStatus(matched ? `가사 로드됨: ${matched}` : "가사를 불러왔습니다.");
    });
  }

  function translateLyrics() {
    const text = $("lyrics-input").value.trim();
    if (!text) {
      setLyricsStatus("번역할 자막/가사를 먼저 추출하거나 입력해 주세요.");
      return;
    }

    const out = $("lyrics-translated");
    setLyricsStatus("번역 중...");
    out.textContent = "번역 중...";
    out.classList.add("ytw-visible");
    $("lyrics-actions").classList.add("ytw-btn-hidden");

    chrome.runtime.sendMessage({ type: "YTW_TRANSLATE", text, targetLang: "auto" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        currentLyricsTranslation = "";
        setLyricsStatus("자동 번역 실패 — 네트워크 상태를 확인해 주세요.");
        out.textContent = "";
        out.classList.remove("ytw-visible");
        return;
      }

      currentLyricsTranslation = response.translatedText || "";
      setLyricsStatus(`번역 완료 [${response.sourceLang} → ${response.targetLang}]`);
      out.textContent = currentLyricsTranslation;
      out.classList.add("ytw-visible");
      $("lyrics-actions").classList.remove("ytw-btn-hidden");

      if (captionSegments.length > 0) {
        const lines = currentLyricsTranslation.split("\n");
        captionSegments.forEach((seg, i) => {
          seg.translated = (lines[i] || "").trim();
        });
        lastCaptionIdx = -1;
      }
    });
  }

  function wireEvents() {
    $("tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tab]");
      if (!btn) return;
      switchTab(btn.getAttribute("data-tab"));
    });

    $("next-short-btn").addEventListener("click", () => {
      relayToTab("NEXT_SHORT");
    });

    $("set-a").addEventListener("click", async () => {
      const res = await relayToTab("SET_A");
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("set-b").addEventListener("click", async () => {
      const res = await relayToTab("SET_B");
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("ab-clear").addEventListener("click", async () => {
      const res = await relayToTab("CLEAR_AB");
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("fav-btn").addEventListener("click", async () => {
      const res = await relayToTab("TOGGLE_FAV");
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("favorites-only").addEventListener("change", async (e) => {
      const res = await relayToTab("SET_FAV_ONLY", { value: e.target.checked });
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("favorites-order").addEventListener("click", async () => {
      const currentShuffle =
        currentSnapshot && currentSnapshot.settings
          ? currentSnapshot.settings.favoritesShuffle !== false
          : true;
      const res = await relayToTab("SET_FAV_SHUFFLE", { value: !currentShuffle });
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("auto-skip-sponsored").addEventListener("change", async (e) => {
      const res = await relayToTab("SET_AUTO_SKIP", { value: e.target.checked });
      if (res.ok && res.snapshot) renderSnapshot(res.snapshot);
    });

    $("memo").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveMemo();
      }
    });

    $("memo-save").addEventListener("click", saveMemo);

    $("music-title").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        translateMusicTitle();
      }
    });

    $("music-refresh").addEventListener("click", async () => {
      const res = await relayToTab("REFRESH_MUSIC");
      if (res.ok && res.snapshot) {
        $("music-title").value = (res.snapshot.music && res.snapshot.music.title) || "";
        renderSnapshot(res.snapshot);
      }
    });

    $("music-translate").addEventListener("click", translateMusicTitle);

    $("music-yt").addEventListener("click", () => {
      const songVid =
        currentSnapshot && currentSnapshot.music && currentSnapshot.music.songVideoId;
      const typed = $("music-title").value.trim();
      const origTitle = (currentSnapshot && currentSnapshot.music && currentSnapshot.music.title) || "";
      if (songVid && (!typed || typed === origTitle)) {
        window.open(
          `https://www.youtube.com/watch?v=${encodeURIComponent(songVid)}`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }
      const q = getEffectiveMusicQuery();
      if (!q) {
        setLyricsStatus("등록된 음악 정보가 없습니다. 곡명을 직접 입력하거나 ↻ 버튼을 눌러보세요.");
        return;
      }
      window.open(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });

    $("music-ytm").addEventListener("click", () => {
      const q = getEffectiveMusicQuery();
      if (!q) {
        setLyricsStatus("등록된 음악 정보가 없습니다. 곡명을 직접 입력하거나 ↻ 버튼을 눌러보세요.");
        return;
      }
      window.open(
        `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });

    $("music-source").addEventListener("click", () => {
      const url = currentSnapshot && currentSnapshot.music && currentSnapshot.music.sourceUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });

    $("music-to-memo").addEventListener("click", async () => {
      const title = getEffectiveMusicTitle();
      if (!title) return;
      const line = currentMusicTranslation ? `🎵 ${title} (${currentMusicTranslation})` : `🎵 ${title}`;
      const memoEl = $("memo");
      memoEl.value = memoEl.value.trim() ? `${memoEl.value.trim()}\n${line}` : line;
      await saveMemo();
    });

    $("captions-fetch").addEventListener("click", fetchCaptions);
    $("lyrics-fetch").addEventListener("click", fetchLyrics);
    $("lyrics-translate").addEventListener("click", translateLyrics);

    $("lyrics-web").addEventListener("click", () => {
      const q = getEffectiveMusicQuery();
      if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q + " lyrics")}`, "_blank", "noopener,noreferrer");
    });

    $("lyrics-copy").addEventListener("click", async () => {
      if (!currentLyricsTranslation) return;
      try {
        await navigator.clipboard.writeText(currentLyricsTranslation);
        setLyricsStatus("번역된 가사/자막을 복사했습니다 ✓");
      } catch (_err) {
        setLyricsStatus("복사 실패 — 직접 드래그해 복사하세요.");
      }
    });

    $("lyrics-to-memo").addEventListener("click", async () => {
      if (!currentLyricsTranslation) return;
      const title = getEffectiveMusicTitle();
      const header = title ? `[🎵 ${title} 번역]\n` : "[자막/가사 번역]\n";
      const memoEl = $("memo");
      const block = `${header}${currentLyricsTranslation}`;
      memoEl.value = memoEl.value.trim() ? `${memoEl.value.trim()}\n\n${block}` : block;
      await saveMemo();
      setLyricsStatus("번역 결과를 메모에 저장했습니다 ✓");
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === "YTW_STATE_PUSH" && message.snapshot) {
      renderSnapshot(message.snapshot);
    } else if (message.type === "YTW_TIME_PUSH" && typeof message.currentTime === "number") {
      updateCurrentTime(message.currentTime);
    }
  });

  async function init() {
    buildStaticButtons();
    wireEvents();
    const res = await relayToTab("GET_STATE");
    if (res.ok && res.snapshot) {
      renderSnapshot(res.snapshot);
    }
  }

  init();
})();


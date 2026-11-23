// FloatingPanel — Shadow DOM isolated UI overlay for Shorts.
// Talks to PlayerController and Storage, never touches YouTube's internal DOM
// (that stays in Adapter).
(function () {
  window.__YTW = window.__YTW || {};

  const HOST_ID = "ytw-panel-host";
  const LEGACY_ID = "ytw-panel";
  const REPEAT_OPTIONS = [1, 3, 5, 10, Infinity];
  const SPEED_OPTIONS = [0.5, 0.75, 0.8, 1, 1.25, 1.5, 2];

  const SHADOW_CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .ytw-panel {
      width: min(280px, calc(100vw - 20px));
      max-height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      background: rgba(18, 18, 22, 0.94);
      color: #f1f1f1;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font-size: 12px;
      line-height: 1.4;
      user-select: none;
      overflow: hidden;
    }

    .ytw-panel.ytw-collapsed {
      width: auto;
    }

    .ytw-panel.ytw-dragging {
      border-color: rgba(255, 255, 255, 0.38);
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.72);
    }

    .ytw-panel.ytw-collapsed .ytw-tabs,
    .ytw-panel.ytw-collapsed .ytw-live-caption,
    .ytw-panel.ytw-collapsed .ytw-body {
      display: none;
    }

    .ytw-live-caption {
      display: none;
      flex-direction: column;
      gap: 3px;
      padding: 7px 10px;
      background: rgba(0, 0, 0, 0.52);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      user-select: text;
    }

    .ytw-live-caption.ytw-visible {
      display: flex;
    }

    .ytw-live-caption-orig {
      font-size: 11.5px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.35;
      word-break: break-word;
    }

    .ytw-live-caption-ko {
      font-size: 11px;
      color: #9ecbff;
      line-height: 1.35;
      word-break: break-word;
    }

    .ytw-tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ytw-tab-btn {
      padding: 5px 4px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: rgba(255, 255, 255, 0.65);
      text-align: center;
      white-space: nowrap;
    }

    .ytw-tab-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .ytw-tab-btn.ytw-tab-active {
      background: rgba(230, 33, 23, 0.24);
      border-color: rgba(255, 68, 58, 0.55);
      color: #ffffff;
    }

    .ytw-tab-pane {
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .ytw-tab-pane.ytw-tab-active {
      display: flex;
    }

    .ytw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 11px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: grab;
      touch-action: none;
    }

    .ytw-header:active {
      cursor: grabbing;
    }

    .ytw-grip {
      font-size: 13px;
      line-height: 1;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: -1px;
      flex-shrink: 0;
    }

    .ytw-header:hover .ytw-grip {
      color: rgba(255, 255, 255, 0.85);
    }

    .ytw-panel.ytw-collapsed .ytw-header {
      border-bottom: none;
      padding: 7px 11px;
    }

    .ytw-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 12.5px;
      letter-spacing: 0.2px;
      color: #ffffff;
    }

    .ytw-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ff3b30;
      flex-shrink: 0;
    }

    .ytw-header-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ytw-badge {
      background: rgba(255, 255, 255, 0.12);
      color: #e5e5e5;
      border-radius: 999px;
      padding: 1px 7px;
      font-size: 10.5px;
      font-weight: 600;
      white-space: nowrap;
    }

    .ytw-collapse-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #f1f1f1;
      border-radius: 6px;
      width: 22px;
      height: 22px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      line-height: 1;
    }

    .ytw-collapse-btn:hover {
      background: rgba(255, 255, 255, 0.14);
    }

    .ytw-body {
      padding: 10px 11px 11px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ytw-body::-webkit-scrollbar,
    .ytw-fav-list::-webkit-scrollbar,
    .ytw-lyrics-translated::-webkit-scrollbar {
      width: 6px;
    }

    .ytw-body::-webkit-scrollbar-thumb,
    .ytw-fav-list::-webkit-scrollbar-thumb,
    .ytw-lyrics-translated::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.22);
      border-radius: 3px;
    }

    .ytw-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ytw-section-title {
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255, 255, 255, 0.62);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ytw-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    button {
      font-family: inherit;
      background: rgba(255, 255, 255, 0.09);
      color: #f1f1f1;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    button.ytw-active {
      background: #e62117;
      border-color: #ff443a;
      color: #ffffff;
      font-weight: 600;
    }

    .ytw-ab-status {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.78);
      font-variant-numeric: tabular-nums;
    }

    .ytw-fav-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
    }

    .ytw-fav-toggle.ytw-is-fav {
      background: rgba(255, 193, 7, 0.2);
      border-color: rgba(255, 193, 7, 0.65);
      color: #ffd54f;
    }

    .ytw-check-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11.5px;
      color: #e8e8e8;
    }

    .ytw-check-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    input[type="checkbox"] {
      accent-color: #e62117;
      width: 14px;
      height: 14px;
      margin: 0;
      cursor: pointer;
    }

    .ytw-mini-btn {
      padding: 2px 7px;
      font-size: 10.5px;
    }

    .ytw-fav-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 280px;
      overflow-y: auto;
      padding: 4px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
    }

    .ytw-fav-empty {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      padding: 8px 4px;
    }

    .ytw-fav-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
    }

    .ytw-fav-item.ytw-current {
      border-color: rgba(255, 213, 79, 0.55);
      background: rgba(255, 213, 79, 0.1);
    }

    .ytw-fav-item-main {
      flex: 1;
      min-width: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .ytw-fav-item-title {
      font-size: 11px;
      color: #f1f1f1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ytw-fav-item-sub {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ytw-fav-del {
      padding: 2px 5px;
      font-size: 10px;
      background: transparent;
      border-color: transparent;
      color: rgba(255, 255, 255, 0.55);
      flex-shrink: 0;
    }

    .ytw-fav-del:hover {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.15);
    }

    textarea,
    .ytw-music-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 11.5px;
      line-height: 1.4;
      user-select: text;
    }

    textarea {
      min-height: 54px;
      resize: vertical;
    }

    textarea:focus,
    .ytw-music-input:focus {
      outline: none;
      border-color: #ff443a;
    }

    .ytw-memo-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .ytw-memo-status {
      font-size: 10.5px;
      color: #7ee787;
      min-height: 14px;
    }

    .ytw-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
    }

    .ytw-sponsor-status {
      color: #ffcc66;
      font-size: 10.5px;
      min-height: 12px;
      word-break: break-word;
    }

    .ytw-music-translation {
      display: none;
      padding: 5px 7px;
      border-radius: 6px;
      background: rgba(88, 166, 255, 0.12);
      border: 1px solid rgba(88, 166, 255, 0.28);
      color: #cfe4ff;
      font-size: 11px;
      line-height: 1.35;
      word-break: break-word;
      user-select: text;
    }

    .ytw-music-translation.ytw-visible {
      display: block;
    }

    .ytw-music-lang {
      font-size: 9.5px;
      color: rgba(207, 228, 255, 0.7);
      margin-right: 4px;
      text-transform: uppercase;
    }

    .ytw-btn-hidden {
      display: none !important;
    }

    .ytw-lyrics-status {
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.65);
      min-height: 14px;
      word-break: break-word;
    }

    .ytw-lyrics-input {
      min-height: 96px;
      max-height: 180px;
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    .ytw-lyrics-translated {
      display: none;
      max-height: 180px;
      overflow-y: auto;
      padding: 7px 8px;
      border-radius: 6px;
      background: rgba(88, 166, 255, 0.1);
      border: 1px solid rgba(88, 166, 255, 0.28);
      color: #d8ebff;
      font-size: 11px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    }

    .ytw-lyrics-translated.ytw-visible {
      display: block;
    }
  `;

  function createFloatingPanel({ controller, storage, onSelectFavorite, getMusicInfo, onRefreshMusic, onDetach }) {
    let host = null;
    let shadow = null;
    let panelEl = null;
    let pendingA = null;
    let currentVideoMeta = null;
    let currentMusicInfo = null;
    let currentMusicTranslation = "";
    let currentLyricsTranslation = "";
    let captionSegments = [];
    let lastCaptionIdx = -1;
    let activeTab = "player";
    let collapsed = false;
    let detachedMode = false;
    let memoStatusTimer = null;
    let musicRetryTimer = null;
    let savedPosition = null;
    let cleanupWindowListeners = null;

    function removeAllExistingPanels() {
      document.querySelectorAll(`#${HOST_ID}, #${LEGACY_ID}`).forEach((el) => el.remove());
    }

    function ensureMounted() {
      if (host && document.contains(host)) return;

      removeAllExistingPanels();

      host = document.createElement("div");
      host.id = HOST_ID;
      host.style.cssText = [
        "position: fixed !important",
        "top: 76px",
        "right: 16px",
        "left: auto",
        "z-index: 2147483647 !important",
        "pointer-events: auto !important",
        "display: block !important",
        "margin: 0 !important",
        "padding: 0 !important",
        "border: none !important",
        "background: transparent !important",
      ].join("; ");

      shadow = host.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = SHADOW_CSS;
      shadow.appendChild(styleEl);

      panelEl = document.createElement("div");
      panelEl.className = "ytw-panel";
      panelEl.innerHTML = buildTemplate();
      shadow.appendChild(panelEl);

      const mountTarget = document.body || document.documentElement;
      mountTarget.appendChild(host);

      wireEvents();
      wireDrag();
    }

    function unmount() {
      clearTimeout(memoStatusTimer);
      clearTimeout(musicRetryTimer);
      if (typeof cleanupWindowListeners === "function") {
        cleanupWindowListeners();
        cleanupWindowListeners = null;
      }
      removeAllExistingPanels();
      host = null;
      shadow = null;
      panelEl = null;
    }

    function buildTemplate() {
      return `
        <div class="ytw-header" data-role="drag-handle" title="드래그하여 위치 이동 (더블클릭: 기본 위치로 복원)">
          <div class="ytw-title-wrap">
            <span class="ytw-grip" aria-hidden="true">⠿</span>
            <span class="ytw-dot"></span>
            <span>YT Organizer</span>
          </div>
          <div class="ytw-header-right">
            <span class="ytw-badge" data-role="repeat-progress">1/1</span>
            <button type="button" class="ytw-collapse-btn" data-role="detach" title="별도 창으로 분리 (브라우저 밖 이동 가능)">↗</button>
            <button type="button" class="ytw-collapse-btn" data-role="toggle" title="접기/펼치기">▾</button>
          </div>
        </div>

        <div class="ytw-tabs" data-role="tabs">
          <button type="button" class="ytw-tab-btn ytw-tab-active" data-tab="player">제어</button>
          <button type="button" class="ytw-tab-btn" data-tab="favorites" data-role="tab-favorites">★ 즐겨찾기 (0)</button>
          <button type="button" class="ytw-tab-btn" data-tab="music">🎵 음악/자막</button>
        </div>

        <div class="ytw-live-caption" data-role="live-caption">
          <div class="ytw-live-caption-orig" data-role="live-caption-orig"></div>
          <div class="ytw-live-caption-ko" data-role="live-caption-ko"></div>
        </div>

        <div class="ytw-body" data-role="body">
          <!-- TAB 1: Player / Memo -->
          <div class="ytw-tab-pane ytw-tab-active" data-pane="player">
            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>Repeat (자동 넘김 횟수)</span>
              </div>
              <div class="ytw-row" data-role="repeat-row"></div>
            </div>

            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>Speed</span>
              </div>
              <div class="ytw-row" data-role="speed-row"></div>
            </div>

            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>A-B Loop</span>
                <span class="ytw-ab-status" data-role="ab-status">A: -- / B: --</span>
              </div>
              <div class="ytw-row">
                <button type="button" data-role="set-a">Set A</button>
                <button type="button" data-role="set-b">Set B</button>
                <button type="button" data-role="ab-clear">Clear</button>
              </div>
            </div>

            <div class="ytw-divider"></div>

            <div class="ytw-section">
              <button type="button" class="ytw-fav-toggle" data-role="fav-btn">☆ 즐겨찾기 추가</button>
            </div>

            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>Memo</span>
                <span style="font-size: 10px; opacity: 0.7;">Ctrl+Enter 저장</span>
              </div>
              <textarea data-role="memo" placeholder="이 쇼츠에 대한 메모를 입력하세요..."></textarea>
              <div class="ytw-memo-footer">
                <button type="button" data-role="memo-save">메모 저장</button>
                <span class="ytw-memo-status" data-role="memo-status"></span>
              </div>
            </div>

            <div class="ytw-divider"></div>

            <div class="ytw-section">
              <label class="ytw-check-label">
                <input type="checkbox" data-role="auto-skip-sponsored" />
                <span>광고/스폰서 자동 넘김</span>
              </label>
              <div class="ytw-sponsor-status" data-role="sponsor-status"></div>
            </div>
          </div>

          <!-- TAB 2: Favorites -->
          <div class="ytw-tab-pane" data-pane="favorites">
            <div class="ytw-section">
              <div class="ytw-check-row">
                <label class="ytw-check-label">
                  <input type="checkbox" data-role="favorites-only" />
                  <span>즐겨찾기만 연속재생</span>
                </label>
                <button type="button" class="ytw-mini-btn" data-role="favorites-order" title="즐겨찾기 재생 순서 전환">랜덤</button>
              </div>
            </div>

            <div class="ytw-section">
              <div class="ytw-section-title">
                <span data-role="fav-list-label">★ 즐겨찾기 목록 (0)</span>
              </div>
              <div class="ytw-fav-list" data-role="fav-list"></div>
            </div>
          </div>

          <!-- TAB 3: Music & Captions/Lyrics -->
          <div class="ytw-tab-pane" data-pane="music">
            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>🎵 곡 제목 / 사운드</span>
                <button type="button" class="ytw-mini-btn" data-role="music-refresh" title="음악 정보 다시 읽기">↻</button>
              </div>
              <input
                type="text"
                class="ytw-music-input"
                data-role="music-title"
                placeholder="음악 정보 없음 (직접 입력 가능)"
              />
              <div class="ytw-music-translation" data-role="music-translation"></div>
              <div class="ytw-row">
                <button type="button" class="ytw-mini-btn" data-role="music-translate" title="음악 제목 번역">제목 번역</button>
                <button type="button" class="ytw-mini-btn" data-role="music-yt" title="YouTube에서 풀버전 검색/듣기">▶ YT</button>
                <button type="button" class="ytw-mini-btn" data-role="music-ytm" title="YouTube Music에서 듣기">🎵 Music</button>
                <button type="button" class="ytw-mini-btn ytw-btn-hidden" data-role="music-source" title="이 사운드의 Shorts 모음 열기">🔗 사운드</button>
                <button type="button" class="ytw-mini-btn" data-role="music-to-memo" title="음악 제목을 메모에 추가">📝</button>
              </div>
            </div>

            <div class="ytw-divider"></div>

            <div class="ytw-section">
              <div class="ytw-section-title">
                <span>자막 / 가사 & 번역</span>
              </div>
              <div class="ytw-row">
                <button type="button" class="ytw-mini-btn" data-role="captions-fetch" title="현재 쇼츠의 영어/자동 자막 추출">CC 자막 추출</button>
                <button type="button" class="ytw-mini-btn" data-role="lyrics-fetch" title="곡 제목으로 가사 자동 검색">가사 찾기</button>
                <button type="button" class="ytw-mini-btn" data-role="lyrics-translate" title="아래 자막/가사 전체 번역">전체 번역</button>
                <button type="button" class="ytw-mini-btn" data-role="lyrics-web" title="Google에서 가사 검색">🔍 웹검색</button>
              </div>
              <div class="ytw-lyrics-status" data-role="lyrics-status"></div>
              <textarea
                class="ytw-lyrics-input"
                data-role="lyrics-input"
                placeholder="CC 자막 추출이나 가사 찾기를 누르거나, 번역할 영어 대사/가사를 직접 붙여넣으세요..."
              ></textarea>
              <div class="ytw-lyrics-translated" data-role="lyrics-translated"></div>
              <div class="ytw-row ytw-btn-hidden" data-role="lyrics-actions">
                <button type="button" class="ytw-mini-btn" data-role="lyrics-copy">번역 복사</button>
                <button type="button" class="ytw-mini-btn" data-role="lyrics-to-memo">메모에 저장</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function q(role) {
      return panelEl ? panelEl.querySelector(`[data-role="${role}"]`) : null;
    }

    function applyCollapsedState(isCollapsed) {
      collapsed = Boolean(isCollapsed);
      if (!panelEl) return;
      panelEl.classList.toggle("ytw-collapsed", collapsed);
      const toggleBtn = q("toggle");
      if (toggleBtn) toggleBtn.textContent = collapsed ? "▸" : "▾";
    }

    function applyPosition(pos) {
      if (!host) return;
      if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) {
        savedPosition = null;
        host.style.left = "auto";
        host.style.right = "16px";
        host.style.top = "76px";
        return;
      }

      const rect = host.getBoundingClientRect();
      const width = rect.width || 280;
      const height = rect.height || 120;
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      const clampedLeft = Math.round(Math.min(Math.max(8, pos.left), maxLeft));
      const clampedTop = Math.round(Math.min(Math.max(8, pos.top), maxTop));

      savedPosition = { left: clampedLeft, top: clampedTop };
      host.style.left = `${clampedLeft}px`;
      host.style.top = `${clampedTop}px`;
      host.style.right = "auto";
    }

    function wireDrag() {
      const handle = q("drag-handle");
      if (!handle) return;

      let dragging = false;
      let moved = false;
      let offsetX = 0;
      let offsetY = 0;

      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest("button")) return;
        dragging = true;
        moved = false;
        const rect = host.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        panelEl.classList.add("ytw-dragging");
        e.preventDefault();
      });

      handle.addEventListener("dblclick", async (e) => {
        if (e.target.closest("button")) return;
        applyPosition(null);
        await storage.saveSettings({ panelPosition: null });
      });

      const onPointerMove = (e) => {
        if (!dragging || !host) return;
        moved = true;
        applyPosition({
          left: e.clientX - offsetX,
          top: e.clientY - offsetY,
        });
      };

      const onPointerUp = async () => {
        if (!dragging) return;
        dragging = false;
        if (panelEl) panelEl.classList.remove("ytw-dragging");
        if (moved && savedPosition) {
          await storage.saveSettings({ panelPosition: savedPosition });
        }
      };

      const onResize = () => {
        if (savedPosition) {
          applyPosition(savedPosition);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("resize", onResize);

      cleanupWindowListeners = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        window.removeEventListener("resize", onResize);
      };
    }

    function stopYouTubeInputLeakage(el) {
      if (!el) return;
      ["keydown", "keyup", "keypress"].forEach((evtName) => {
        el.addEventListener(evtName, (e) => {
          e.stopPropagation();
        });
      });
    }

    function wireEvents() {
      panelEl.addEventListener(
        "wheel",
        (e) => {
          e.stopPropagation();
        },
        { passive: true }
      );

      const detachBtn = q("detach");
      const isCompactMobile = window.innerWidth <= 640 || location.hostname === "m.youtube.com";
      if (isCompactMobile) {
        detachBtn.classList.add("ytw-btn-hidden");
      }
      detachBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      detachBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof onDetach === "function") {
          onDetach();
        }
      });

      const toggleBtn = q("toggle");
      toggleBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      toggleBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        applyCollapsedState(!collapsed);
        await storage.saveSettings({ panelCollapsed: collapsed });
      });

      const repeatRow = q("repeat-row");
      REPEAT_OPTIONS.forEach((value) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = value === Infinity ? "∞" : String(value);
        btn.addEventListener("click", async () => {
          controller.setRepeatCount(value);
          await storage.saveSettings({ repeatCount: value === Infinity ? "inf" : value });
          highlightActive(repeatRow, btn);
        });
        repeatRow.appendChild(btn);
      });

      const speedRow = q("speed-row");
      SPEED_OPTIONS.forEach((value) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${value}x`;
        btn.addEventListener("click", async () => {
          controller.setPlaybackRate(value);
          await storage.saveSettings({ playbackRate: value });
          highlightActive(speedRow, btn);
        });
        speedRow.appendChild(btn);
      });

      q("set-a").addEventListener("click", () => {
        pendingA = controller.getCurrentTime();
        updateAbStatus();
      });

      q("set-b").addEventListener("click", () => {
        if (pendingA === null) return;
        const b = controller.getCurrentTime();
        controller.setABLoop(pendingA, b, 5);
        updateAbStatus();
      });

      q("ab-clear").addEventListener("click", () => {
        pendingA = null;
        controller.clearABLoop();
        updateAbStatus();
      });

      q("fav-btn").addEventListener("click", async () => {
        if (!currentVideoMeta) return;
        const isFav = await storage.toggleFavorite(currentVideoMeta);
        renderFavoriteButton(isFav);
        await refreshFavoritesList();
      });

      q("favorites-only").addEventListener("change", async (e) => {
        await storage.saveSettings({ favoritesOnly: e.target.checked });
      });

      q("favorites-order").addEventListener("click", async () => {
        const current = await storage.getSettings();
        const nextShuffle = !current.favoritesShuffle;
        await storage.saveSettings({ favoritesShuffle: nextShuffle });
        renderFavoritesOrderButton(nextShuffle);
      });

      q("tabs").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tab]");
        if (!btn) return;
        switchTab(btn.getAttribute("data-tab"));
      });

      const musicInput = q("music-title");
      stopYouTubeInputLeakage(musicInput);
      musicInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          translateMusicTitle();
        }
      });

      q("music-refresh").addEventListener("click", () => {
        refreshMusicInfo();
        if (typeof onRefreshMusic === "function") {
          onRefreshMusic();
        }
      });

      q("music-translate").addEventListener("click", () => {
        if (!getEffectiveMusicQuery()) {
          setLyricsStatus("등록된 음악 정보가 없습니다. 곡명을 직접 입력하거나 ↻ 버튼을 눌러보세요.");
          return;
        }
        translateMusicTitle();
      });

      q("music-yt").addEventListener("click", () => {
        const songVid = currentMusicInfo && currentMusicInfo.songVideoId;
        const typed = q("music-title") ? q("music-title").value.trim() : "";
        const origTitle = (currentMusicInfo && currentMusicInfo.title) || "";
        if (songVid && (!typed || typed === origTitle)) {
          window.open(
            `https://www.youtube.com/watch?v=${encodeURIComponent(songVid)}`,
            "_blank",
            "noopener,noreferrer"
          );
          return;
        }
        const query = getEffectiveMusicQuery();
        if (!query) {
          setLyricsStatus("등록된 음악 정보가 없습니다. 곡명을 직접 입력하거나 ↻ 버튼을 눌러보세요.");
          return;
        }
        window.open(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          "_blank",
          "noopener,noreferrer"
        );
      });

      q("music-ytm").addEventListener("click", () => {
        const query = getEffectiveMusicQuery();
        if (!query) {
          setLyricsStatus("등록된 음악 정보가 없습니다. 곡명을 직접 입력하거나 ↻ 버튼을 눌러보세요.");
          return;
        }
        window.open(
          `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
          "_blank",
          "noopener,noreferrer"
        );
      });

      q("music-source").addEventListener("click", () => {
        if (currentMusicInfo && currentMusicInfo.sourceUrl) {
          window.open(currentMusicInfo.sourceUrl, "_blank", "noopener,noreferrer");
        }
      });

      q("music-to-memo").addEventListener("click", async () => {
        const title = getEffectiveMusicTitle();
        if (!title || !panelEl) return;
        const memoEl = q("memo");
        const line = currentMusicTranslation
          ? `🎵 ${title} (${currentMusicTranslation})`
          : `🎵 ${title}`;
        memoEl.value = memoEl.value.trim() ? `${memoEl.value.trim()}\n${line}` : line;
        await saveCurrentMemo();
      });

      const lyricsInput = q("lyrics-input");
      stopYouTubeInputLeakage(lyricsInput);

      q("captions-fetch").addEventListener("click", () => {
        fetchVideoCaptions();
      });

      q("lyrics-fetch").addEventListener("click", () => {
        fetchSongLyrics();
      });

      q("lyrics-translate").addEventListener("click", () => {
        translateLyricsText();
      });

      q("lyrics-web").addEventListener("click", () => {
        const query = getEffectiveMusicQuery();
        if (!query) return;
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(query + " lyrics")}`,
          "_blank",
          "noopener,noreferrer"
        );
      });

      q("lyrics-copy").addEventListener("click", async () => {
        if (!currentLyricsTranslation) return;
        try {
          await navigator.clipboard.writeText(currentLyricsTranslation);
          setLyricsStatus("번역된 가사를 클립보드에 복사했습니다 ✓");
        } catch (_err) {
          setLyricsStatus("복사 실패 — 번역 텍스트를 직접 드래그해 복사하세요.");
        }
      });

      q("lyrics-to-memo").addEventListener("click", async () => {
        if (!currentLyricsTranslation || !panelEl) return;
        const title = getEffectiveMusicTitle();
        const header = title ? `[🎵 ${title} 가사 번역]\n` : "[가사 번역]\n";
        const memoEl = q("memo");
        const block = `${header}${currentLyricsTranslation}`;
        memoEl.value = memoEl.value.trim() ? `${memoEl.value.trim()}\n\n${block}` : block;
        await saveCurrentMemo();
        setLyricsStatus("번역된 가사를 메모에 저장했습니다 ✓");
      });

      const memoEl = q("memo");
      stopYouTubeInputLeakage(memoEl);
      memoEl.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          saveCurrentMemo();
        }
      });

      q("memo-save").addEventListener("click", () => {
        saveCurrentMemo();
      });

      q("auto-skip-sponsored").addEventListener("change", async (e) => {
        await storage.saveSettings({ autoSkipSponsored: e.target.checked });
      });
    }

    function switchTab(tabName) {
      if (!panelEl || !tabName) return;
      activeTab = tabName;
      panelEl.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.classList.toggle("ytw-tab-active", btn.getAttribute("data-tab") === activeTab);
      });
      panelEl.querySelectorAll("[data-pane]").forEach((pane) => {
        pane.classList.toggle("ytw-tab-active", pane.getAttribute("data-pane") === activeTab);
      });
      if (activeTab === "favorites") {
        refreshFavoritesList();
      }
    }

    async function saveCurrentMemo() {
      if (!currentVideoMeta || !panelEl) return;
      const text = q("memo").value;
      await storage.saveMemo(currentVideoMeta.videoId, text);
      showMemoStatus(text ? "저장됨 ✓" : "메모 삭제됨");
      await refreshFavoritesList();
    }

    function showMemoStatus(message) {
      const el = q("memo-status");
      if (!el) return;
      el.textContent = message;
      clearTimeout(memoStatusTimer);
      memoStatusTimer = setTimeout(() => {
        if (q("memo-status")) q("memo-status").textContent = "";
      }, 2000);
    }

    function highlightActive(row, activeBtn) {
      if (!row) return;
      Array.from(row.children).forEach((btn) =>
        btn.classList.toggle("ytw-active", btn === activeBtn)
      );
    }

    function updateAbStatus() {
      if (!panelEl) return;
      const state = controller.getState();
      const a = pendingA !== null ? pendingA.toFixed(2) : "--";
      const b = state.abLoop ? state.abLoop.end.toFixed(2) : "--";
      q("ab-status").textContent = `A: ${a} / B: ${b}`;
    }

    function updatePlayerState(state) {
      if (!panelEl || !state) return;
      const badge = q("repeat-progress");
      if (badge) {
        if (state.repeatCount === Infinity) {
          badge.textContent = `${state.repeatIndex + 1}/∞`;
        } else {
          badge.textContent = `${state.repeatIndex + 1}/${state.repeatCount}`;
        }
      }
      updateAbStatus();
    }

    function renderFavoriteButton(isFav) {
      const btn = q("fav-btn");
      if (!btn) return;
      btn.classList.toggle("ytw-is-fav", isFav);
      btn.textContent = isFav ? "★ 즐겨찾기됨" : "☆ 즐겨찾기 추가";
    }

    function renderFavoritesOrderButton(isShuffle) {
      const btn = q("favorites-order");
      if (!btn) return;
      btn.textContent = isShuffle ? "랜덤" : "순서";
    }

    async function refreshFavoritesList() {
      if (!panelEl) return;
      const [favorites, memos] = await Promise.all([
        storage.getFavorites(),
        storage.getAllMemos(),
      ]);

      const label = q("fav-list-label");
      if (label) label.textContent = `★ 즐겨찾기 목록 (${favorites.length})`;
      const tabFav = q("tab-favorites");
      if (tabFav) tabFav.textContent = `★ 즐겨찾기 (${favorites.length})`;

      const listEl = q("fav-list");
      if (!listEl) return;
      listEl.textContent = "";

      if (favorites.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ytw-fav-empty";
        empty.textContent = "저장된 즐겨찾기가 없습니다.";
        listEl.appendChild(empty);
        return;
      }

      const activeId = currentVideoMeta ? currentVideoMeta.videoId : null;
      favorites.forEach((fav) => {
        const item = document.createElement("div");
        item.className = "ytw-fav-item";
        if (fav.videoId === activeId) item.classList.add("ytw-current");

        const main = document.createElement("div");
        main.className = "ytw-fav-item-main";
        main.title = fav.title || fav.videoId;
        main.addEventListener("click", () => {
          if (typeof onSelectFavorite === "function") {
            onSelectFavorite(fav.videoId);
          }
        });

        const titleEl = document.createElement("div");
        titleEl.className = "ytw-fav-item-title";
        const hasMemo = Boolean(memos[fav.videoId]);
        titleEl.textContent = `${hasMemo ? "📝 " : ""}${fav.title || fav.videoId}`;

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
          await storage.removeFavorite(fav.videoId);
          if (currentVideoMeta && currentVideoMeta.videoId === fav.videoId) {
            renderFavoriteButton(false);
          }
          await refreshFavoritesList();
        });

        item.appendChild(main);
        item.appendChild(delBtn);
        listEl.appendChild(item);
      });
    }

    function getEffectiveMusicTitle() {
      const input = q("music-title");
      const typed = input ? input.value.trim() : "";
      if (typed) return typed;
      return (currentMusicInfo && currentMusicInfo.title) || "";
    }

    function getEffectiveMusicQuery() {
      const input = q("music-title");
      const typed = input ? input.value.trim() : "";
      if (typed) {
        return (
          typed
            .replace(/^(original sound|원본 사운드|오리지널 사운드)\s*[-·•:|]\s*/i, "")
            .replace(/\s*[·•]\s*/g, " - ")
            .replace(/\.{3,}$|…$/g, "")
            .trim() || typed
        );
      }
      return (currentMusicInfo && currentMusicInfo.searchQuery) || "";
    }

    function clearMusicTranslation() {
      currentMusicTranslation = "";
      const box = q("music-translation");
      if (!box) return;
      box.textContent = "";
      box.classList.remove("ytw-visible");
    }

    function setMusicInfo(info) {
      if (!panelEl || !info) return;
      currentMusicInfo = info;
      const input = q("music-title");
      if (input && info.title) {
        input.value = info.title;
      }
      const srcBtn = q("music-source");
      if (srcBtn) {
        srcBtn.classList.toggle("ytw-btn-hidden", !info.sourceUrl);
      }
    }

    function refreshMusicInfo() {
      if (!panelEl) return;
      const info =
        typeof getMusicInfo === "function"
          ? getMusicInfo()
          : { title: "", searchQuery: "", sourceUrl: null, hasMusic: false };
      currentMusicInfo = info;
      clearMusicTranslation();

      const input = q("music-title");
      if (input) {
        input.value = info.title || "";
      }

      const srcBtn = q("music-source");
      if (srcBtn) {
        srcBtn.classList.toggle("ytw-btn-hidden", !info.sourceUrl);
      }
    }

    function translateMusicTitle() {
      const text = getEffectiveMusicQuery();
      const box = q("music-translation");
      if (!text || !box) return;

      box.textContent = "번역 중...";
      box.classList.add("ytw-visible");

      const targetVideoId = currentVideoMeta ? currentVideoMeta.videoId : null;

      chrome.runtime.sendMessage(
        { type: "YTW_TRANSLATE", text, targetLang: "auto" },
        (response) => {
          if (currentVideoMeta && currentVideoMeta.videoId !== targetVideoId) return;
          if (!q("music-translation")) return;

          const lastErr = chrome.runtime.lastError;
          if (lastErr || !response || !response.ok) {
            currentMusicTranslation = "";
            box.textContent = "";
            const msg = document.createElement("span");
            msg.textContent = "자동 번역 실패 — ";
            const link = document.createElement("a");
            link.href = `https://translate.google.com/?sl=auto&tl=ko&text=${encodeURIComponent(text)}&op=translate`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Google 번역에서 열기";
            link.style.color = "#8cc2ff";
            box.appendChild(msg);
            box.appendChild(link);
            return;
          }

          currentMusicTranslation = response.translatedText || "";
          box.textContent = "";
          const langTag = document.createElement("span");
          langTag.className = "ytw-music-lang";
          langTag.textContent = `[${response.sourceLang}→${response.targetLang}]`;
          const textNode = document.createTextNode(currentMusicTranslation);
          box.appendChild(langTag);
          box.appendChild(textNode);
        }
      );
    }

    function setLyricsStatus(msg) {
      const el = q("lyrics-status");
      if (el) el.textContent = msg || "";
    }

    function clearLyricsUI() {
      currentLyricsTranslation = "";
      captionSegments = [];
      lastCaptionIdx = -1;
      setLyricsStatus("");
      const input = q("lyrics-input");
      if (input) input.value = "";
      const out = q("lyrics-translated");
      if (out) {
        out.textContent = "";
        out.classList.remove("ytw-visible");
      }
      const actions = q("lyrics-actions");
      if (actions) actions.classList.add("ytw-btn-hidden");
      const liveBox = q("live-caption");
      if (liveBox) liveBox.classList.remove("ytw-visible");
      const liveOrig = q("live-caption-orig");
      if (liveOrig) liveOrig.textContent = "";
      const liveKo = q("live-caption-ko");
      if (liveKo) liveKo.textContent = "";
    }

    function updateCurrentTime(currentTimeSec) {
      if (!panelEl || captionSegments.length === 0) return;
      const idx = captionSegments.findIndex(
        (seg) => currentTimeSec >= seg.startSec && currentTimeSec <= seg.endSec
      );
      if (idx === lastCaptionIdx) return;
      lastCaptionIdx = idx;

      const liveOrig = q("live-caption-orig");
      const liveKo = q("live-caption-ko");
      if (!liveOrig || !liveKo) return;

      if (idx === -1) {
        liveOrig.textContent = "";
        liveKo.textContent = "";
        return;
      }

      const seg = captionSegments[idx];
      liveOrig.textContent = seg.text || "";
      liveKo.textContent = seg.translated || "";
    }

    function fetchVideoCaptions() {
      if (!currentVideoMeta || !currentVideoMeta.videoId) {
        setLyricsStatus("현재 쇼츠 영상 ID를 확인할 수 없습니다.");
        return;
      }

      const targetVideoId = currentVideoMeta.videoId;
      setLyricsStatus("YouTube 자막 추출 중...");

      chrome.runtime.sendMessage(
        { type: "YTW_FETCH_CAPTIONS", videoId: targetVideoId },
        (response) => {
          if (!currentVideoMeta || currentVideoMeta.videoId !== targetVideoId) return;
          if (!panelEl) return;

          const lastErr = chrome.runtime.lastError;
          if (lastErr || !response || !response.ok) {
            captionSegments = [];
            lastCaptionIdx = -1;
            const liveBox = q("live-caption");
            if (liveBox) liveBox.classList.remove("ytw-visible");
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

          const input = q("lyrics-input");
          if (input) {
            input.value = captionSegments.map((s) => s.text).join("\n");
          }

          const liveBox = q("live-caption");
          if (liveBox) liveBox.classList.add("ytw-visible");

          const autoLabel = response.isAutoGenerated ? "자동 생성" : "수동";
          setLyricsStatus(
            `자막 로드됨 (${response.languageCode}, ${autoLabel}, ${captionSegments.length}줄) — 전체 번역을 누르면 실시간 한글 자막도 표시됩니다.`
          );
          updateCurrentTime(controller.getCurrentTime());
        }
      );
    }

    function fetchSongLyrics() {
      const query = getEffectiveMusicQuery();
      if (!query) {
        setLyricsStatus("곡 제목을 먼저 입력하거나 확인해 주세요.");
        return;
      }

      setLyricsStatus("가사 검색 중...");
      const targetVideoId = currentVideoMeta ? currentVideoMeta.videoId : null;

      chrome.runtime.sendMessage({ type: "YTW_FETCH_LYRICS", query }, (response) => {
        if (currentVideoMeta && currentVideoMeta.videoId !== targetVideoId) return;
        if (!panelEl) return;

        const lastErr = chrome.runtime.lastError;
        if (lastErr || !response || !response.ok) {
          setLyricsStatus("자동 가사 없음 — 🔍 웹검색으로 찾거나 직접 붙여넣어 번역하세요.");
          return;
        }

        captionSegments = [];
        lastCaptionIdx = -1;
        const liveBox = q("live-caption");
        if (liveBox) liveBox.classList.remove("ytw-visible");

        const input = q("lyrics-input");
        if (input) input.value = response.lyrics || "";
        const matched = [response.artistName, response.trackName].filter(Boolean).join(" - ");
        setLyricsStatus(matched ? `가사 로드됨: ${matched}` : "가사를 불러왔습니다.");
      });
    }

    function translateLyricsText() {
      const input = q("lyrics-input");
      const text = input ? input.value.trim() : "";
      if (!text) {
        setLyricsStatus("번역할 자막/가사를 먼저 추출하거나 입력해 주세요.");
        return;
      }

      const out = q("lyrics-translated");
      const actions = q("lyrics-actions");
      if (!out) return;

      setLyricsStatus("번역 중...");
      out.textContent = "번역 중...";
      out.classList.add("ytw-visible");
      if (actions) actions.classList.add("ytw-btn-hidden");

      const targetVideoId = currentVideoMeta ? currentVideoMeta.videoId : null;

      chrome.runtime.sendMessage(
        { type: "YTW_TRANSLATE", text, targetLang: "auto" },
        (response) => {
          if (currentVideoMeta && currentVideoMeta.videoId !== targetVideoId) return;
          if (!q("lyrics-translated")) return;

          const lastErr = chrome.runtime.lastError;
          if (lastErr || !response || !response.ok) {
            currentLyricsTranslation = "";
            setLyricsStatus("자동 번역 실패 — 네트워크 상태를 확인하거나 Google 번역을 이용해 주세요.");
            out.textContent = "";
            out.classList.remove("ytw-visible");
            return;
          }

          currentLyricsTranslation = response.translatedText || "";
          setLyricsStatus(`번역 완료 [${response.sourceLang} → ${response.targetLang}]`);
          out.textContent = currentLyricsTranslation;
          out.classList.add("ytw-visible");
          if (actions) actions.classList.remove("ytw-btn-hidden");

          if (captionSegments.length > 0) {
            const translatedLines = currentLyricsTranslation.split("\n");
            captionSegments.forEach((seg, i) => {
              seg.translated = (translatedLines[i] || "").trim();
            });
            lastCaptionIdx = -1;
            updateCurrentTime(controller.getCurrentTime());
          }
        }
      );
    }

    function findChildByText(row, text) {
      if (!row) return null;
      return Array.from(row.children).find((btn) => btn.textContent === text) || null;
    }

    async function onVideoChanged(videoMeta, settings) {
      currentVideoMeta = videoMeta;
      ensureMounted();
      pendingA = null;
      updateAbStatus();
      clearLyricsUI();
      q("sponsor-status").textContent = "";
      q("memo-status").textContent = "";

      applyCollapsedState(settings.panelCollapsed);
      applyPosition(settings.panelPosition || null);

      refreshMusicInfo();
      clearTimeout(musicRetryTimer);
      if (!currentMusicInfo || !currentMusicInfo.hasMusic) {
        const expectedId = videoMeta.videoId;
        musicRetryTimer = setTimeout(() => {
          if (currentVideoMeta && currentVideoMeta.videoId === expectedId) {
            refreshMusicInfo();
          }
        }, 700);
      }

      const repeatValue = settings.repeatCount === "inf" ? Infinity : settings.repeatCount;
      controller.setRepeatCount(repeatValue);
      controller.setPlaybackRate(settings.playbackRate);
      highlightActive(
        q("repeat-row"),
        findChildByText(q("repeat-row"), repeatValue === Infinity ? "∞" : String(repeatValue))
      );
      highlightActive(
        q("speed-row"),
        findChildByText(q("speed-row"), `${settings.playbackRate}x`)
      );

      q("auto-skip-sponsored").checked = Boolean(settings.autoSkipSponsored);
      q("favorites-only").checked = Boolean(settings.favoritesOnly);
      renderFavoritesOrderButton(settings.favoritesShuffle !== false);
      updatePlayerState(controller.getState());

      const targetVideoId = videoMeta.videoId;
      const [isFav, memo] = await Promise.all([
        storage.isFavorite(targetVideoId),
        storage.getMemo(targetVideoId),
      ]);

      if (!currentVideoMeta || currentVideoMeta.videoId !== targetVideoId) return;

      if (detachedMode) {
        applyCollapsedState(true);
      }

      renderFavoriteButton(isFav);
      q("memo").value = memo;
      await refreshFavoritesList();
    }

    function setDetachedMode(isDetached) {
      detachedMode = Boolean(isDetached);
      if (!panelEl) return;
      if (detachedMode) {
        applyCollapsedState(true);
      } else {
        storage.getSettings().then((s) => applyCollapsedState(s.panelCollapsed));
      }
      const btn = q("detach");
      if (btn) {
        btn.title = detachedMode
          ? "분리된 창 앞으로 가져오기"
          : "별도 창으로 분리 (브라우저 밖 이동 가능)";
      }
    }

    async function syncExternalState(settings, isFav, memo) {
      if (!panelEl) return;
      const repeatValue = settings.repeatCount === "inf" ? Infinity : settings.repeatCount;
      highlightActive(
        q("repeat-row"),
        findChildByText(q("repeat-row"), repeatValue === Infinity ? "∞" : String(repeatValue))
      );
      highlightActive(
        q("speed-row"),
        findChildByText(q("speed-row"), `${settings.playbackRate}x`)
      );
      q("auto-skip-sponsored").checked = Boolean(settings.autoSkipSponsored);
      q("favorites-only").checked = Boolean(settings.favoritesOnly);
      renderFavoritesOrderButton(settings.favoritesShuffle !== false);
      if (typeof isFav === "boolean") renderFavoriteButton(isFav);
      if (typeof memo === "string") q("memo").value = memo;
      updatePlayerState(controller.getState());
      await refreshFavoritesList();
    }

    function notifySponsorSkipped(signals) {
      ensureMounted();
      const el = q("sponsor-status");
      if (el) {
        el.textContent = "⏭ Skipped sponsored Short (" + signals.join(", ") + ")";
      }
    }

    function showNotice(message) {
      ensureMounted();
      const el = q("sponsor-status");
      if (el) {
        el.textContent = message || "";
      }
    }

    return {
      ensureMounted,
      unmount,
      onVideoChanged,
      updatePlayerState,
      updateCurrentTime,
      setMusicInfo,
      setDetachedMode,
      syncExternalState,
      notifySponsorSkipped,
      showNotice,
    };
  }

  window.__YTW.createFloatingPanel = createFloatingPanel;
})();

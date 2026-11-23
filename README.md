# YouTube Shorts Organizer & Learning Player

[English](./README.md) | [한국어 (Korean)](./README.ko.md)

A local-first Chrome Extension (Manifest V3) & cross-browser Userscript that turns YouTube Shorts into a structured **learning player & organizer** — with N-times repeat, 2-second auto-advance, A-B loop, favorites-only playback, per-video memos, music/caption/lyrics translation, ad/sponsor auto-skip, and a detachable pop-out window.

---

## Key Features

* **Shorts Repeat & 2s Auto-Advance**: Choose `1`, `3`, `5`, `10`, or `∞` repeats. After finishing the configured count, holds briefly for **2 seconds** and automatically advances to the next Short.
* **Playback Speed & A-B Loop**: Persistent `0.5x` – `2.0x` playback speed and A-B section looping for language/music study.
* **Favorites & Favorites-Only Playback**: Independent local favorites list with **Favorites-Only continuous playback** (random shuffle or sequential).
* **Per-Video Memos**: Save personal notes per Short (`Ctrl+Enter` quick save).
* **Music, Captions & Lyrics Translation (`🎵 음악/자막` tab)**:
  * Auto-detects background music titles (DOM + YouTube `/watch` official music card), translates titles inline, and opens the official full song directly on **YouTube (`▶ YT`)** or **YouTube Music (`🎵 Music`)**.
  * Extracts YouTube English/auto-generated captions (`CC`), translates the full transcript, and optionally displays a live synced bilingual subtitle bar (**disabled by default** — toggle `실시간 자막 바 표시` when needed).
  * Searches lyrics via LRCLIB and translates full lyrics inline.
* **Ad & Sponsor Auto-Skip Toggle**: Single checkbox (`광고/스폰서 자동 넘김`) to toggle automatic skipping for Shorts sponsored/in-feed ads and regular YouTube video ads.
* **Draggable Panel & Detached Window (`↗`)**: Drag the Shadow-DOM overlay anywhere inside the browser (position saved; double-click header to reset), or pop it out into a **separate window** for multi-monitor / outside-browser control.
* **Safari (iOS / macOS) & Mobile Browser Support**: Supports `m.youtube.com` via Safari Web Extension or the standalone Userscript ([`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js)).

---

## Installation

### 1. Desktop Chrome / Edge / Brave (Recommended)
1. Download the latest `youtube-shorts-organizer-v*.zip` from **[Releases](https://github.com/paek/youtube-shorts-organizer/releases)** and extract it (or `git clone` this repo and use the `extension/` folder).
2. Open `chrome://extensions` (or `edge://extensions`) and turn **ON** **Developer mode** (top-right).
3. Click **Load unpacked** (top-left) and select the extracted folder (the folder containing `manifest.json`).
4. *(Optional)* Click the puzzle icon (🧩) in the browser toolbar and pin **YouTube Shorts Organizer** so you can open the detached window in one click.

### 2. iOS / macOS Safari & Android Browsers
* **iOS / iPadOS Safari** (no Mac/Xcode required): Install the free **Userscripts** app from the App Store and load [`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js), then open `https://m.youtube.com/shorts`.
* **macOS / iOS Native Safari Web Extension** & **Android (Firefox / Kiwi / Lemur)**: See the full step-by-step guide in **[SAFARI_IOS_SETUP.md](./SAFARI_IOS_SETUP.md)**.
* *(Note: Official iOS Chrome and official Android Chrome do not support extensions or userscripts due to browser platform restrictions.)*

---

## How to Use

Open any YouTube Shorts page (`https://www.youtube.com/shorts/...`). The **YT Organizer** panel appears in the top-right corner.

### Panel Header Controls
* **Drag header (`⠿ YT Organizer`)**: Move the panel anywhere inside the browser (position is automatically saved).
* **Double-click header**: Reset panel back to default top-right position.
* **`↗` button (or toolbar icon)**: Pop out YT Organizer into an independent window that can be dragged outside the browser or onto a second monitor.
* **`▾` / `▸` button**: Collapse or expand the panel.

### Tab 1 — `제어` (Player & Memo)
* **Repeat**: Select `1`, `3`, `5`, `10`, or `∞`. With finite counts, the Short plays N times, pauses for 2 seconds at the end, and automatically advances to the next Short.
* **Speed**: Select `0.5x` to `2x` (persisted across Shorts).
* **A-B Loop**: Click `Set A` at the start timestamp, `Set B` at the end timestamp to loop that section, and `Clear` to cancel.
* **Favorite (`☆` / `★`)**: Add or remove the current Short from your local favorites.
* **Memo**: Write notes for the current Short and click **메모 저장** (or press `Ctrl+Enter`).
* **광고/스폰서 자동 넘김**: Check to automatically skip Shorts sponsored/in-feed ads and regular YouTube watch-page ads; uncheck to disable.

### Tab 2 — `★ 즐겨찾기` (Favorites)
* **즐겨찾기만 연속재생**: Check to continuously play only your saved favorite Shorts (choose **랜덤** for shuffle or **순서** for sequential order).
* Click any item in the list to jump directly to that Short, or click `✕` to remove it.

### Tab 3 — `🎵 음악/자막` (Music, Captions & Lyrics)
* **곡 제목 / 사운드**: Automatically detects the Short's music title (click `↻` to re-fetch, or edit/type manually).
  * `제목 번역`: Translates the title inline.
  * `▶ YT`: Opens the official full song video on YouTube directly (or searches YouTube if no direct track ID is linked).
  * `🎵 Music`: Searches the song on YouTube Music.
  * `🔗 사운드`: Opens YouTube's Shorts sound collection page when available.
  * `📝`: Appends the detected song title (and translation) to the current Short's Memo.
* **자막 / 가사 & 번역**:
  * `CC 자막 추출`: Extracts YouTube captions (manual or auto-generated English/other) into the text box.
  * `가사 찾기`: Searches song lyrics via LRCLIB.
  * `전체 번역`: Translates the entire extracted caption/lyrics (or any text you paste).
  * `실시간 자막 바 표시` *(default OFF)*: Check to display a synced bilingual subtitle bar while the Short plays.

---

## Packaging a Release ZIP

Run `package-release.bat` (Windows) or `package-release.ps1` to generate `dist/youtube-shorts-organizer-v<version>.zip` ready for GitHub Releases.

## Versioning Policy

Follows **Semantic Versioning (`MAJOR.MINOR.PATCH`)**:
* `MAJOR`: Breaking changes to storage format or core UX
* `MINOR`: New user-facing features or significant enhancements (resets `PATCH` to `0`)
* `PATCH`: Bug fixes, stability/performance improvements, or small UI tweaks
* Docs/test-only changes do not bump the version. See [CHANGELOG.md](./CHANGELOG.md).

## Author & License

* **Creator**: Baek Hung-Ju (`contact@acegame.com`)
* **License**: **GNU General Public License v3.0 (GPL-3.0)** — see [LICENSE](./LICENSE). Any modified distributions must also be shared openly under GPL-3.0.

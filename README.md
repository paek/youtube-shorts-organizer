# YouTube Shorts Organizer & Learning Player

[English](./README.md) | [한국어 (Korean)](./README.ko.md)

A local-first Chrome Extension (Manifest V3) that turns YouTube Shorts into a structured **learning player & organizer** — with N-times repeat, auto-advance, A-B loop, favorites-only playback, per-video memos, music/caption/lyrics translation, ad/sponsor auto-skip, and a detachable pop-out window.

## Key Features

* **Shorts Repeat & Auto-Advance**: Choose `1`, `3`, `5`, `10`, or `∞` repeats. After finishing the configured count, holds briefly for **2 seconds** and automatically advances to the next Short.
* **Playback Speed & A-B Loop**: Persistent `0.5x` – `2.0x` playback speed and A-B section looping for language/music study.
* **Favorites & Favorites-Only Playback**: Independent local favorites list with **Favorites-Only continuous playback** (random shuffle or sequential).
* **Per-Video Memos**: Save notes per Short (`Ctrl+Enter` quick save).
* **Music, Captions & Lyrics Translation (`🎵 음악/자막` tab)**:
  * Auto-detects background music titles (DOM + YouTube official music metadata), translates titles inline, and opens the official full song on **YouTube** or **YouTube Music**.
  * Extracts YouTube English/auto-generated captions (`CC`), translates the full transcript, and displays a **live synced bilingual subtitle bar**.
  * Searches lyrics via LRCLIB and translates full lyrics inline.
* **Ad & Sponsor Auto-Skip Toggle**: Single checkbox (`광고/스폰서 자동 넘김`) to toggle automatic skipping for Shorts sponsored/in-feed ads and regular YouTube video ads.
* **Draggable Panel & Detached Window (`↗`)**: Drag the Shadow-DOM overlay anywhere inside the browser (position saved), or pop it out into a **separate window** for multi-monitor / outside-browser control.
* **Safari (iOS / macOS) & Mobile Browser Support**: Works on `m.youtube.com` via Safari Web Extension (`extension/`) or the standalone Userscript ([`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js)). See **[SAFARI_IOS_SETUP.md](./SAFARI_IOS_SETUP.md)**.

## Installation (Chrome Developer Mode)

1. Download the latest release ZIP from **[Releases](https://github.com/paek/youtube-shorts-organizer/releases)** and extract it (or clone this repo).
2. Open `chrome://extensions` in Chrome and enable **Developer mode** (top-right).
3. Click **Load unpacked** (top-left) and select the extracted folder (or `extension/` if cloned).
4. Open any YouTube Shorts page — the **YT Organizer** panel appears at the top-right.
   * Pin the toolbar icon from Chrome's puzzle menu (🧩) to open the detached window in one click.

## Packaging a Release ZIP

Run `package-release.bat` (Windows) or `package-release.ps1` to generate a clean `dist/youtube-shorts-organizer-v<version>.zip` ready to upload to GitHub Releases.

## Versioning Policy

This project follows **Semantic Versioning (`MAJOR.MINOR.PATCH`)**:
* `MAJOR`: Breaking changes to storage format or core UX (explicit approval required)
* `MINOR`: New user-facing features or significant enhancements (resets `PATCH` to `0`)
* `PATCH`: Bug fixes, stability/performance improvements, or small UI tweaks
* Docs/test-only changes do not bump the version. See [CHANGELOG.md](./CHANGELOG.md).

## Author & License

* **Creator**: Baek Hung-Ju (`contact@acegame.com`)
* **License**: **GNU General Public License v3.0 (GPL-3.0)** — see [LICENSE](./LICENSE). Any modified distributions must also be shared openly under GPL-3.0.

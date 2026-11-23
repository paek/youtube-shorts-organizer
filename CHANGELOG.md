# Changelog

All notable changes to **YouTube Shorts Organizer & Learning Player** are documented in this file.
Versioning follows Semantic Versioning (`MAJOR.MINOR.PATCH`).

## [Unreleased]

## [0.2.0] - 2026-11-23

### Added
- Shadow DOM isolated floating panel with drag-to-move, viewport clamping, and persisted position.
- 3-tab organizer menu (`제어` / `★ 즐겨찾기` / `🎵 음악/자막`).
- Favorites list viewer, item jump/delete, and Favorites-Only continuous playback (random shuffle or sequential).
- Detached pop-out window (`↗`) and Chrome toolbar action icon for multi-monitor / outside-browser control.
- Music title auto-detection (DOM + YouTube `/watch` official music card), inline title translation, direct YouTube full-song playback, and YouTube Music search.
- YouTube caption (`CC`) extraction, full transcript translation, live synced bilingual subtitle bar, and LRCLIB lyrics search & translation.
- Release ZIP packaging script (`package-release.ps1` / `package-release.bat`) and bilingual README (`README.md` / `README.ko.md`).

### Changed
- Added a 2-second grace delay after a Short finishes playing before advancing to the next Short, and hardened end-of-video detection against reused `<video>` elements.
- Unified Shorts sponsored/in-feed ad auto-skip and regular YouTube watch-page ad skip under the single `광고/스폰서 자동 넘김` checkbox.
- Scoped Shorts ad/sponsor detection strictly to the active Short with a 1.4s post-skip transition cooldown to prevent skipping the following normal Short.

### Fixed
- Fixed duplicate unstyled panels stacking on the left side under YouTube's navigation drawer (`document.body.contains` vs `document.documentElement.appendChild`).
- Fixed `Extension context invalidated` unhandled promise rejection in `storage.js` and orphaned `onNavigate` polling after extension reload.
- Blocked keyboard/wheel event leakage from memo/lyrics inputs to YouTube Shorts shortcuts.

## [0.1.0] - 2026-09-01

### Added
- Initial Phase 1 MVP: Shorts N-times repeat, playback speed, A-B loop, favorite toggle, per-video memo, basic sponsored-skip, and declarativeNetRequest ad-blocking rules.

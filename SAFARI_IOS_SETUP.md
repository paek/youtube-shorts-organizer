# Safari (iOS / macOS) & Mobile Browser Setup Guide

## Platform Compatibility Summary

| Platform / Browser | Supported? | Recommended Method |
|---|---|---|
| **Desktop Chrome / Edge / Brave** | ✅ Full | Load `extension/` unpacked |
| **macOS Safari** | ✅ Full | Safari Web Extension (Xcode) or Userscript |
| **iOS / iPadOS Safari** (`m.youtube.com`) | ✅ Yes | **Userscripts app (easiest, no Xcode)** or Safari Web Extension |
| **Android Firefox / Kiwi / Lemur** (`m.youtube.com`) | ✅ Yes | Load `extension/` or Userscript (Tampermonkey/Violentmonkey) |
| **iOS Chrome / Android Chrome (Official)** | ❌ Not supported by browser | Official mobile Chrome blocks extensions & userscripts; use **iOS Safari** or **Android Firefox/Kiwi** instead |

---

## Option 1: iOS / iPadOS Safari (1-Minute Setup, No Mac/Xcode Needed)

1. Install the free **Userscripts** app from the iOS App Store.
2. Open iOS **Settings → Safari → Extensions → Userscripts** and turn it **ON** (allow on `youtube.com` / `m.youtube.com`).
3. Copy [`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js) into the Userscripts folder (via Files app / iCloud Drive).
4. Open `https://m.youtube.com/shorts` in **Safari**.
   * A compact **YT Organizer** pill appears at the top-right — tap `▸` to expand or drag to move.

---

## Option 2: Native macOS / iOS Safari Web Extension (Mac + Xcode)

`extension/` already supports both `https://www.youtube.com/*` and `https://m.youtube.com/*` (Manifest V3).
On a Mac with Xcode installed, convert it into a native macOS + iOS Safari Web Extension project in one command:

```bash
xcrun safari-web-extension-converter ./extension \
  --project-location ./safari-build \
  --app-name "YT Shorts Organizer" \
  --bundle-identifier com.acegame.ytshortsorganizer
```

1. Open the generated `.xcodeproj` in Xcode.
2. Select your Apple Developer Team under **Signing & Capabilities**.
3. Build & run the **iOS** or **macOS** target.
4. Enable the extension in **Safari Settings → Extensions** (or iOS **Settings → Safari → Extensions**).

---

## Option 3: Android (Kiwi / Lemur / Firefox)

* **Kiwi / Lemur Browser (Chromium-based)**:
  1. Download the release `.zip` from GitHub Releases.
  2. Open `chrome://extensions` → enable **Developer mode** → **+(from .zip/.crx/.user.js)** → select the `.zip` file.
* **Android Firefox**:
  1. Install **Tampermonkey** or **Violentmonkey** from Firefox Add-ons.
  2. Import [`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js).
  3. Open `https://m.youtube.com/shorts`.

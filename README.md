<div align="center">

```
███████╗██╗██████╗ ███████╗███████╗ ██████╗ ██╗  ██╗    ████████╗ █████╗ ██████╗ 
██╔════╝██║██╔══██╗██╔════╝██╔════╝██╔═══██╗╚██╗██╔╝    ╚══██╔══╝██╔══██╗██╔══██╗
█████╗  ██║██████╔╝█████╗  █████╗  ██║   ██║ ╚███╔╝        ██║   ███████║██████╔╝
██╔══╝  ██║██╔══██╗██╔══╝  ██╔══╝  ██║   ██║ ██╔██╗        ██║   ██╔══██║██╔══██╗
██║     ██║██║  ██║███████╗██║     ╚██████╔╝██╔╝ ██╗       ██║   ██║  ██║██████╔╝
╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚═════╝ 
```

**A custom Firefox new tab & homepage — your browser, your dashboard.**

[![Firefox](https://img.shields.io/badge/Firefox-140%2B-FF7139?style=flat-square&logo=firefox-browser&logoColor=white)](https://www.mozilla.org/firefox/)
[![Manifest](https://img.shields.io/badge/Manifest-v2-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)
[![License](https://img.shields.io/badge/License-MIT-2ac48a?style=flat-square)](./LICENSE)
[![AMO](https://img.shields.io/badge/AMO-home--assist--universal--tab-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://addons.mozilla.org/)
[![No data collected](https://img.shields.io/badge/Data%20collected-none-2ac48a?style=flat-square)](#privacy)

</div>

---

## ✦ What is this?

**Firefox Tab** replaces your new tab page and homepage with a personal dashboard. No tracking, no ads, no cloud — everything runs locally in your browser.

Every time you open a new tab you get:

- 🔆 **Home Assistant controls** — toggle your smart home devices in one click
- 🖥 **Server monitor** — real-time ping & latency for all your servers
- 🌐 **Network info** — your external IP, ISP, location, and organisation
- 🔍 **Search bar** — Google search or direct URL navigation

---

## ✦ Preview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              F I R E F O X  (animated gradient)                 │
│                                                                 │
│   ╔═══════════════════════════════════════════════════════╗     │
│   ║  G  │  Search with Google or enter address...         ║     │
│   ╚═══════════════════════════════════════════════════════╝     │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  Home Assistant │ │    Servers      │ │    Network      │    │
│  │                 │ │                 │ │                 │    │
│  │ [Up Light ] ON  │ │ ● Server 1  ext │ │ IP   1.2.3.4    │    │
│  │ [Table    ] OFF │ │ ● NAS      lan  │ │ ISP  Comcast    │    │
│  │ [Sub PC   ] ON  │ │ ◉ Server 2 ext │ │ Loc  NY, US     │    │
│  │ [Printer  ] OFF │ │ ● Home srv lan  │ │ Org  AS12345    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│                                                            ⚙️   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✦ Features

### 🏠 Home Assistant Widget
- Toggle any `switch.*`, `light.*`, or other HA entities
- Optimistic UI — the button responds instantly, then syncs with real state
- Automatic polling every 60 seconds
- Token stored encrypted with **AES-256-GCM** — never in plaintext

### 🖥 Server Monitor
- HEAD-request ping for each server every 5 minutes
- Shows latency in ms or `unreachable`
- Visual tags: **EXT** (external) / **LAN** (local network)
- Background script proxy — no CORS issues

### 🌐 Network Info
- External IP via [ipwho.is](https://ipwho.is) with [ip-api.com](http://ip-api.com) fallback
- ISP, location, and organisation
- Skeleton loading animation while fetching

### ⚙️ Settings Page
- Full GUI — no config file editing needed
- Add / remove devices and servers dynamically
- HA token shown/hidden toggle, stored encrypted
- Opens via gear button (bottom-right corner)

---

## ✦ Installation

### From source (recommended for personal use)

```bash
git clone https://github.com/YOUR_USERNAME/firefox-tab.git
cd firefox-tab
```

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on"**
3. Select `manifest.json` from the cloned folder

> The extension will reload on browser restart — for permanent install, see below.

### Permanent install (self-signed)

1. Go to `about:config` in Firefox
2. Set `xpinstall.signatures.required` → `false`
3. Zip the extension folder and rename to `.xpi`
4. Drag & drop the `.xpi` into Firefox

---

## ✦ Configuration

Click the **⚙ gear icon** in the bottom-right corner of any new tab to open Settings.

### Home Assistant

| Field | Example |
|-------|---------|
| URL | `http://homeassistant.local:8123` |
| Token | Long-lived access token from HA profile |
| Entity ID | `switch.living_room`, `light.bedroom` |
| Display name | Any label you want |

> **Token security:** The token is encrypted with AES-256-GCM before being saved to `browser.storage.local`. The encryption key is auto-generated per browser profile and never leaves your device.

### Servers

| Field | Value |
|-------|-------|
| Name | Display label |
| URL | Full URL including port |
| Type | `EXT` — internet / `LAN` — local network |

---

## ✦ File Structure

```
firefox-tab/
├── manifest.json          # Extension manifest (MV2)
├── newtab.html            # New tab / homepage UI
├── newtab.js              # Dashboard logic & polling
├── crypto.js              # AES-256-GCM token encryption
├── background.js          # Fetch proxy + homepage redirect
├── options.html           # Settings page UI
├── options.js             # Settings page logic
└── icons/
    ├── icon-48.svg
    └── icon-96.svg
```

---

## ✦ How it works

```
New tab opened
      │
      ▼
background.js intercepts about:home / about:newtab
      │
      ▼
newtab.html loads → reads config from browser.storage.local
      │
      ├── Decrypts HA token via crypto.js
      ├── Builds Smart Home grid (DOM)
      ├── Builds Server list (DOM)
      │
      ▼
All network requests → background.js (fetch proxy)
      │                  avoids CORS / CSP restrictions
      ▼
Results rendered in UI with polling loops
```

---

## ✦ Privacy

| What | Collected? |
|------|-----------|
| Browsing history | ❌ No |
| Personal data | ❌ No |
| Analytics / telemetry | ❌ No |
| Data sent to any server | ❌ No |
| HA token | Stored **encrypted locally** only |

The extension makes outbound requests only to:
- Your own Home Assistant instance
- Your own configured servers
- `ipwho.is` / `ip-api.com` — to display your own IP info

Declared in manifest: **`"required": ["none"]`** — Firefox confirms to users that no data is collected.

---

## ✦ Requirements

- Firefox **140+** (desktop) / **142+** (Android)
- Python 3 (only if using the included local dev server)
- A running Home Assistant instance *(optional)*

---

## ✦ Local dev server

A simple Python HTTP server is included for testing the HTML outside the extension context:

```bash
# Windows
start_server.bat

# macOS / Linux
python3 -m http.server 8080
```

Then open `http://localhost:8080/newtab.html` in your browser.

> Note: `browser.*` APIs won't be available outside the extension context — use `about:debugging` for full testing.

---

## ✦ Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

```bash
# Lint with web-ext before submitting
npx web-ext lint
```

Please keep the zero-dependency philosophy — no npm packages, no bundlers, vanilla JS only.

---

## ✦ License

[MIT](./LICENSE) — do whatever you want, just don't claim you made it from scratch 🙂

---

<div align="center">

Made with ☕ and way too many new tabs open

</div>

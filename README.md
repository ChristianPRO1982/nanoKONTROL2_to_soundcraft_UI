# nanoKONTROL2 → Soundcraft UI12 Runtime

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Linux](https://img.shields.io/badge/Linux-Ubuntu-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)
![MIDI](https://img.shields.io/badge/MIDI-nanoKONTROL2-6A1B9A?style=for-the-badge)
![Soundcraft](https://img.shields.io/badge/Soundcraft-UI12-CC0000?style=for-the-badge)
![WebSocket](https://img.shields.io/badge/WebSocket-Live_Control-010101?style=for-the-badge)
![Standalone](https://img.shields.io/badge/Runtime-Standalone-2E8B57?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Prototype-orange?style=for-the-badge)
![Config Driven](https://img.shields.io/badge/Architecture-Config_Driven-1E90FF?style=for-the-badge)
![Live Audio](https://img.shields.io/badge/Use-Live_Audio-8A2BE2?style=for-the-badge)

---

# 🎛️ Turn a nanoKONTROL2 into a real live console companion for the Soundcraft UI12

A lightweight standalone runtime that transforms a cheap MIDI controller into a practical physical interface for the Soundcraft UI12.

No Docker.  
No cloud.  
No DAW.  
No complicated setup.

Just:
- a PC,
- a nanoKONTROL2,
- a Soundcraft UI12,
- and live control that finally feels physical.

---

# ⚡ Why this project exists

The Soundcraft UI12 is powerful, compact and affordable.

But in real live situations:
- touching a screen during a concert is not always comfortable,
- quickly grabbing a fader matters,
- muting something instantly matters,
- changing banks matters,
- physical feedback matters.

This project gives the UI12:
- physical faders,
- physical mute buttons,
- physical solo buttons,
- player transport controls,
- configurable banks,
- reusable live setups.

The goal is NOT to replace the UI12 interface.

The goal is to make it much more usable during:
- churches,
- rehearsals,
- small concerts,
- theater,
- portable live sound setups.

---

# 🚀 Quick start

## Requirements

- Linux (tested on Ubuntu)
- Node.js 20+
- npm
- Soundcraft UI12
- Korg nanoKONTROL2

---

## Install

```bash
git clone <repository-url>

cd nanoKONTROL2_to_soundcraft_UI/ui12-midi

npm install
```

---

## Launch

```bash
npm start
```

---

## Runtime display mode (`.env`)

The runtime supports two terminal display modes controlled by `UI_MODE`.

Create `ui12-midi/.env`:

```env
UI_MODE=debug
# UI_MODE=run
# UI_MODE=prod
# UI12_HOST=10.10.1.1
```

Mode behavior:

* `debug` (default): verbose append-only logs, no terminal clear.
* `run`: compact live screen, terminal clear on runtime actions, fader ASCII table.
* `prod`: alias of `run`.

---

## Tests

```bash
cd ui12-midi
npm install
npm test
```

---

## At startup

The runtime will:

1. Scan available configurations
2. Ask which live setup to load
3. Connect to the UI12
4. Connect to nanoKONTROL2 MIDI IN and MIDI OUT
5. Start the live runtime

In `run/prod` mode:

* startup logs stay visible (no clear during initialization),
* screen clearing starts only when first runtime action is received.

---

# 🎚️ Features

## Already working

* MIDI input support
* MIDI output support (nanoKONTROL2 LEDs)
* WebSocket communication with UI12
* UI12 feedback parsing and local state store (`SETD`)
* Debug/run terminal display modes (`UI_MODE`)
* Physical faders
* Gain knobs
* Solo buttons
* Mute buttons
* `S` LEDs reflect confirmed UI12 solo state
* `M` LEDs reflect confirmed UI12 mute state
* `R` LEDs blink on fader/UI12 mix mismatch (hysteresis-based)
* LED full refresh on bank switch and websocket reconnect
* Periodic LED recovery render for live robustness
* Multiple banks
* MP3 transport controls
* Auto/manual playback toggle
* Stereo group abstraction
* Config-driven mappings
* Multiple reusable live profiles
* Live fader ASCII table in run mode (gain/solo/mute/fader view)

---

# 💡 LED feedback (V3)

The runtime is now bidirectional for live feedback:

```text
nanoKONTROL2 -> UI12 controls
UI12 -> nanoKONTROL2 LEDs
```

Rules currently implemented:

* UI12 feedback is the source of truth for `S/M` LEDs.
* Physical `S/M` presses do not light LEDs optimistically; LEDs update on confirmed UI12 `SETD`.
* `R` LEDs (record row) are used as mismatch warning indicators for non-motorized faders.
* `R` blinks when `|physicalFader - ui12Mix|` is above dirty threshold and stops when below clean threshold.
* Step-2 defaults: `dirty=0.06`, `clean=0.04`, `blink=400ms`, startup blink phase ON.
* Stereo references for feedback use left-side channel priority (`*.0`) for `line/player`.
* No soft takeover or pickup blocking is applied: faders still send values normally.

---

# 🧠 Smart abstraction system

The runtime separates:

* technical mixer logic
* from live usage logic

You configure:

* what you want to control

The runtime automatically knows:

* how to control it technically.

Example:

```ini
[bank:1]
f1 = i1
f2 = i2
f8 = master
```

The runtime automatically infers:

* mix
* gain
* mute
* solo
* stereo expansion

without requiring technical UI12 paths in mappings.

---

# 🎛️ Bank system

Banks allow multiple live contexts.

Example:

```text
Bank 1 → microphones
Bank 2 → instruments
Bank 3 → player/master
Bank 4 → FX
```

The same logical target may appear in multiple banks.

This makes the runtime practical for real live usage instead of being locked to mixer topology.

---

# 🔊 Stereo-aware runtime

Stereo targets are automatically expanded internally.

Example:

```text
line
```

controls:

```text
l.0
l.1
```

without duplicating configuration manually.

Same for:

* player
* stereo groups
* future stereo targets

---

# 🎵 Built-in player transport

The nanoKONTROL2 transport buttons directly control:

* Play
* Stop
* Previous track
* Next track
* Auto/manual playback mode

This is especially useful for:

* churches,
* backing tracks,
* theater cues,
* rehearsal playback.

---

# ⚙️ Configuration-driven architecture

The runtime is designed around external mapping files.

You can create:

* messe.map
* theatre.map
* rehearsal.map
* concert.map

without modifying JavaScript code.

This allows:

* fast setup switching,
* reusable live profiles,
* simpler maintenance,
* cleaner architecture.

---

# 📁 Repository layout

```text
project/
├── docs/
├── ui12-midi/
    ├── nanoKONTROL2.js
    ├── runtime/
    ├── configs/
    ├── tests/
    └── package.json
└── ui12-web/
```

Meaning:

* `docs/`: architecture and development guidance used during implementation.
* `ui12-midi/`: production runtime (Node.js bridge between nanoKONTROL2 and Soundcraft UI12).
* `ui12-midi/configs/`: live mapping profiles (`.map`) loaded at startup.
* `ui12-midi/.env`: optional runtime environment overrides (`UI_MODE`, `UI12_HOST`).
* `ui12-web/`: reverse-engineering workspace for UI12 web interface (not production runtime).

---

# 📜 Contracts

The project separates:

* runtime engine,
* technical contracts,
* live mappings.

Available contracts:

```text
docs/
├── aliases.contract.json
├── ui12.contract.json
├── transport.contract.json
└── controller-nanokontrol2.contract.json
```

Contracts define:

* aliases,
* protocol behavior,
* transport actions,
* controller layout and LED runtime parameters (OUT port, blink interval, hysteresis thresholds, preflight SysEx).

They do NOT define live setups.

---

# 🎼 Live mappings

Live mappings are stored in:

```text
ui12-midi/configs/
```

Examples:

```text
ui12-midi/configs/
└── validated-prototype.map
```

The runtime scans configurations automatically at startup.

Minimal `.map` format:

```ini
[meta]
name = my-live-setup

[bank:1]
f1 = i1
f2 = line
f8 = master

[bank:2]
f1 = player
f6 = sub1
```

---

# 🛠️ Design philosophy

This project intentionally prioritizes:

* live stability,
* readability,
* quick troubleshooting,
* lightweight runtime,
* editable mappings,
* practical live usage.

Over:

* overengineering,
* unnecessary abstractions,
* enterprise complexity,
* heavy frameworks.

---

# 🔮 Future ideas

Possible future extensions:

* UI24R support
* AUX support
* FX support
* extended bidirectional synchronization (beyond current LEDs)
* web mapping editor
* OSC bridge
* multiple controller support
* preset switching
* scene management

---

# 📌 Current status

Current state:

* contract-driven runtime engine
* `.map`-driven live profiles
* UI12-confirmed `S/M` LED feedback
* `R` LED mismatch blinking with hysteresis
* terminal-only operation

---

# 📄 License

MIT

# Refactor configuration-driven architecture for nanoKONTROL2 ↔ Soundcraft UI12 bridge

## Context

The current implementation directly hardcodes:
- banks
- channel mappings
- UI12 paths
- transport actions
- stereo groups
- button behavior

inside the main NodeJS runtime file.

The prototype is now validated in real live conditions:
- MIDI input works
- WebSocket communication with Soundcraft UI12 works
- channel mix/gain/mute/solo works
- stereo targets work
- MP3 player transport works
- multiple banks work

The next step is to move to a configuration-driven architecture.

---

# Objective

Refactor the application so that:
- the main JS file becomes a generic runtime engine
- all mapping logic is externalized in configuration files
- multiple configurations can coexist
- mappings become editable without touching JS code

---

# Important design principle

The configuration file must describe:
- WHAT the user wants to control

The runtime engine must know:
- HOW to control it technically

Example:
The configuration should say:
- `i1`
- `line`
- `player`
- `sub1`
- `master`

The runtime internally translates:
- mix
- gain
- solo
- mute
- stereo coupling
- UI12 websocket paths

The user must NOT manually define:
- `.mix`
- `.gain`
- `.solo`
- `.mute`
- stereo left/right paths

These are runtime responsibilities.

---

# Target architecture

## Runtime

Single generic runtime:
- websocket connection
- MIDI listener
- bank management
- toggle state management
- UI12 communication
- transport actions
- config loading

Example:
- `nanoKONTROL2.js`

---

## Configurations

Configurations stored in:
- `./configs`

Multiple configuration profiles must be supported:
- messe
- concert
- répétition
- theatre
- etc.

---

# Required features

## 1. Config discovery

At startup:
- scan `./configs`
- detect available config files
- display indexed list in terminal
- ask user which config to load

Example flow:
1. Scan configs
2. Display numbered list
3. Wait for keyboard input
4. Load selected config

---

## 2. Runtime abstraction

The runtime must no longer contain:
- hardcoded banks
- hardcoded channel assignments
- hardcoded stereo logic
- hardcoded UI12 paths per bank

All mappings must come from configuration.

---

## 3. Internal logical aliases

Runtime must support logical aliases.

Examples:
- `i1`
- `i2`
- `line`
- `player`
- `sub1`
- `master`

The runtime translates aliases into:
- UI12 websocket paths
- stereo targets
- mute/solo/gain/mix actions

---

## 4. Automatic behavior inference

The config only maps:
- a strip
- or a logical target

The runtime automatically infers:
- fader → mix
- knob → gain
- S button → solo
- M button → mute

No explicit declaration required in config.

---

## 5. Stereo target support

Runtime must support stereo abstractions.

Example:
- `line`
controls:
- `l.0`
- `l.1`

Example:
- `player`
controls:
- `p.0`
- `p.1`

This stereo expansion must happen internally.

---

## 6. Bank system

Runtime must support:
- multiple banks
- dynamic bank switching
- same target reused across banks

Bank switching remains controlled by:
- MARKER LEFT
- MARKER RIGHT

---

## 7. Global controls

Runtime must support global actions independent from banks:
- MEDIA_PLAY
- MEDIA_STOP
- MEDIA_PREV
- MEDIA_NEXT
- play mode toggle

These controls remain always active.

---

## 8. Toggle states

Runtime must internally maintain toggle states for:
- mute
- solo
- autoplay
- future toggle features

States must persist while application runs.

---

## 9. Future extensibility

Architecture must allow future support for:
- FX
- AUX
- more banks
- LEDs
- motorized controllers
- bidirectional synchronization
- multiple MIDI devices
- multiple UI12 profiles

Do not hardcode assumptions limiting future expansion.

---

# Required implementation structure

## Recommended files

Example target structure:

```text
project/
├── nanoKONTROL2.js
├── runtime/
├── configs/
├── mappings/
├── ui12/
└── README.md
```

Structure may differ if cleaner.

---

# Config contract

The actual config file formats are intentionally separated from this task.

This implementation MUST:

* support a lightweight human-editable mapping format
* support logical aliases
* support multiple banks

The detailed config contracts are defined separately.

Do not invent alternate config schemas.

---

# Constraints

## Must keep

Must preserve:

* existing websocket behavior
* existing keepalive
* existing MIDI behavior
* existing transport support
* existing bank switching concept

---

## Must avoid

Do NOT:

* hardcode banks
* hardcode channels
* hardcode specific live setups
* hardcode aliases in switch/case spaghetti

Prefer:

* tables
* registries
* dictionaries
* reusable abstractions

---

# Runtime expectations

The runtime should become:

* generic
* readable
* modular
* easy to debug live

Live stability is more important than abstraction purity.

Avoid overengineering.

---

# Error handling

Must handle gracefully:

* missing config
* malformed config
* missing MIDI device
* websocket disconnect
* invalid alias
* invalid bank reference

Errors must remain readable for live usage.

---

# Logging

Keep terminal logs concise and useful for live debugging.

Examples:

* loaded config
* selected bank
* websocket connected
* websocket disconnected
* invalid mapping
* MIDI device not found

Avoid noisy logs during normal operation.

---

# Acceptance criteria

Implementation is complete when:

* runtime starts
* config selection works
* existing mappings still function
* banks load from config
* no hardcoded live setup remains
* adding a new config requires zero JS modification
* stereo targets work
* transport works
* mute/solo/gain/mix work
* live behavior remains stable

---

# Important mindset

This project is now transitioning from:

* proof of concept

to:

* reusable live control runtime

The runtime must stay:

* lightweight
* understandable
* robust in live conditions
* editable quickly during rehearsals/live events

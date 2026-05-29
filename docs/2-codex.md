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

The prototype has been validated in live conditions:
- MIDI input works
- WebSocket communication with Soundcraft UI12 works
- channel mix/gain/mute/solo works
- stereo targets work
- MP3 player transport works
- multiple banks work

The next step is to move to a configuration-driven architecture.

---

# Sources of truth and priority

The functional reference for this refactor is:
1. `./docs/*.contract.json`
2. validated live prototype behavior

If behavior in current legacy code diverges from this reference, the reference above MUST win.

`./ui12-midi/` contains the runtime to refactor, but its current implementation is NOT the functional oracle in case of divergence.

---

# Scope and out of scope

## In scope

- refactor the runtime located in `./ui12-midi/`
- move runtime behavior to configuration-driven mapping
- preserve live-stable behavior defined by contracts and validated prototype

## Out of scope

- changes to `./ui12-web/` behavior or structure
- new reverse-engineering work for UI12 web frontend
- any requirement that makes `./ui12-web/` part of production runtime

`./ui12-web/` is considered complete and kept as exploration workspace only.

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

Decision rules:
- if no config is found: abort startup with a clear error message
- default selection is index `1` when the user presses Enter without value
- invalid selection (non-numeric or out of range) MUST not crash runtime and MUST ask again

Example flow:
1. Scan configs
2. Display numbered list
3. Wait for keyboard input
4. Resolve selected index using the rules above
5. Load selected config

## 2. Runtime abstraction

The runtime must no longer contain:
- hardcoded banks
- hardcoded channel assignments
- hardcoded stereo logic
- hardcoded UI12 paths per bank

All mappings must come from configuration and contract-based runtime rules.

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

## 4. Automatic behavior inference

The config only maps:
- a strip
- or a logical target

The runtime automatically infers:
- fader -> mix
- knob -> gain
- S button -> solo
- M button -> mute

Inference MUST be capability-aware:
- the action is only allowed if that capability exists for the alias in `aliases.contract.json`
- unsupported capability mappings MUST be ignored safely and logged as configuration/runtime warnings

No explicit declaration of `.mix/.gain/.solo/.mute` is required in config.

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

## 6. Bank system

Runtime must support:
- multiple banks
- dynamic bank switching
- same target reused across banks

Bank switching remains controlled by:
- MARKER LEFT
- MARKER RIGHT

Decision rule for N banks:
- MARKER LEFT moves to previous bank
- MARKER RIGHT moves to next bank
- navigation uses clamp boundaries, not wrap-around
- at first bank, MARKER LEFT keeps first bank
- at last bank, MARKER RIGHT keeps last bank

## 7. Global controls

Runtime must support global actions independent from banks:
- MEDIA_PLAY
- MEDIA_STOP
- MEDIA_PREV
- MEDIA_NEXT
- play mode toggle

These controls remain always active.

## 8. Toggle states

Runtime must internally maintain toggle states for:
- mute
- solo
- autoplay
- future toggle features

State rules:
- local runtime state is the source of truth for toggle transitions
- default startup state is `off` for mute/solo and `manual` for autoplay
- after websocket reconnection, local toggle state is kept in memory
- runtime MUST NOT auto-replay all toggle states on reconnect
- state changes are applied when the corresponding control is used again

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

This refactor is contract-driven. The implementation MUST be aligned with:
- `./docs/aliases.contract.json`: logical aliases, channels, capabilities
- `./docs/ui12.contract.json`: websocket protocol, keepalive, value conventions, global settings
- `./docs/transport.contract.json`: transport commands and play mode behavior
- `./docs/controller-nanokontrol2.contract.json`: MIDI controller layout and control IDs

This implementation MUST:
- support a lightweight human-editable mapping format
- support logical aliases
- support multiple banks

Do not invent alternate config schemas that conflict with these contracts.

---

# Constraints

## Must keep

Must preserve behavior defined by contracts and validated prototype:
- websocket behavior
- keepalive
- MIDI behavior
- transport support
- bank switching concept

## Must avoid

Do NOT:
- hardcode banks
- hardcode channels
- hardcode specific live setups
- hardcode aliases in switch/case spaghetti

Prefer:
- tables
- registries
- dictionaries
- reusable abstractions

---

# Runtime expectations

The runtime should become:
- generic
- readable
- modular
- easy to debug live

Live stability is more important than abstraction purity.
Avoid overengineering.

---

# Error handling

Must handle gracefully:
- missing config
- malformed config
- missing MIDI device
- websocket disconnect
- invalid alias
- invalid bank reference

Errors must remain readable for live usage.

---

# Logging

Keep terminal logs concise and useful for live debugging.

Runtime display modes:
- `debug` mode:
  - append-only logs
  - no terminal clear
  - full websocket unavailable traces (`WS indisponible...`) remain visible
- `run` mode (and `prod` alias):
  - no clear during startup sequence (config selection, MIDI detection, startup banner)
  - clear is allowed only on runtime actions after startup
  - compact live screen must include:
    - mapping title
    - current bank
    - last action
    - fader ASCII table for strips 1..8
  - table shows integer `0..10` values for gain/fader, plus solo/mute markers

Examples:
- loaded config
- selected bank
- websocket connected
- websocket disconnected
- invalid mapping
- MIDI device not found

Avoid noisy logs during normal operation.

---

# Acceptance criteria

Implementation is complete when:
- runtime starts from `./ui12-midi/`
- config selection works with default and invalid-input rules
- no hardcoded live setup table remains in runtime logic
- banks are loaded from config
- alias resolution follows `aliases.contract.json`
- capability checks are enforced before sending commands
- unsupported capability actions are ignored safely and logged
- stereo aliases expand internally as defined by contracts
- transport controls remain global across all banks
- mute/solo/gain/mix behavior remains functional
- adding a new config requires zero JS mapping code modification
- no runtime dependency on `./ui12-web/`
- live behavior remains stable
- `UI_MODE` supports `debug`, `run`, and `prod` (`prod` aliases `run`)
- `run` mode renders compact screen + fader ASCII table and keeps startup logs visible

---

# Document validation checklist

Before considering this spec final:
- every MUST statement is testable by runtime test or direct inspection
- no contradiction remains between inference rules and alias capabilities
- no requirement implies modifying `./ui12-web/`
- no requirement uses current legacy code as functional oracle

---

# Important mindset

This project is transitioning from:
- proof of concept

to:
- reusable live control runtime

The runtime must stay:
- lightweight
- understandable
- robust in live conditions
- editable quickly during rehearsals/live events

# Project organization

## Runtime project

`./ui12-midi/`

Contains the runtime used to control the Soundcraft UI12 from the Korg nanoKONTROL2.

This folder contains:
- the Node.js runtime,
- MIDI handling,
- WebSocket communication,
- bank management,
- mapping engine,
- runtime configuration loading.

This is the main application folder.

---

## UI12 reverse engineering workspace

`./ui12-web/`

Used to inspect and reverse engineer the Soundcraft UI12 web interface.

This folder is used to:
- identify WebSocket endpoints,
- inspect JavaScript behavior,
- discover transport commands,
- understand UI12 internal mappings,
- capture runtime protocol behavior.

This folder is NOT the runtime itself.

---

## Documentation

`./docs/`

Contains all architecture and implementation documentation used by Codex during development.

Includes:
- runtime architecture,
- contracts,
- mapping system,
- implementation plans,
- project conventions.
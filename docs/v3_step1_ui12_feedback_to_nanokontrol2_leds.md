# V3 step 1 — UI12 feedback to nanoKONTROL2 LEDs

## Context

The current runtime already controls a Soundcraft UI12 from a Korg nanoKONTROL2.

This task adds the reverse direction:

```text
Soundcraft UI12 → Node.js runtime → nanoKONTROL2 LEDs
```

This first V3 step is only about confirmed UI12 state feedback for LEDs.

Do not implement fader mismatch blinking in this task.  
That is covered by a separate document.

---

# Core principle

The nanoKONTROL2 sends user intentions.

The UI12 remains the only source of truth.

LEDs on the nanoKONTROL2 must reflect UI12 confirmed state only.

Example:

1. User presses physical `M1`
2. Runtime sends a mute request to UI12
3. UI12 sends back `SETD^...mute^1`
4. Runtime updates local state
5. Runtime lights the physical `M1` LED

Do not light LEDs optimistically when a physical button is pressed.

---

# Scope

Implement feedback LEDs for:

- `S` buttons → solo state
- `M` buttons → mute state

Do not implement:

- `R` blinking
- fader mismatch detection
- soft takeover
- motorized fader behavior
- complex stereo aggregation
- UI12 fast polling

---

# Stereo simplification for this step

For V3 step 1, stereo targets use only the left-side path as reference.

Examples:

```text
line   → l.0
player → p.0
```

The runtime must trust UI12 to manage linked stereo behavior.

Do not implement OR / AND logic between left and right channels in this step.

---

# Required state store

Add or update a runtime state store populated from UI12 feedback.

It must at least store:

```text
*.mute
*.solo
```

Recommended generic structure:

```js
stateStore.set("i.0.mute", 1);
stateStore.set("i.0.solo", 0);
stateStore.get("i.0.mute");
```

Missing or unknown values must be treated as `0` for LED rendering.

---

# UI12 message parsing

Parse incoming UI12 websocket messages such as:

```text
SETD^i.0.mute^1
SETD^i.0.solo^0
```

The parser should emit structured events, for example:

```js
{
  type: "set",
  path: "i.0.mute",
  value: 1
}
```

Only `SETD` messages are required for this step.

---

# MIDI output

Open a MIDI OUT connection to the nanoKONTROL2.

The nanoKONTROL2 may require external LED mode configured through Korg Kontrol Editor.

Expected LED values:

```text
value 127 = LED on
value 0   = LED off
```

Relevant controllers:

```text
S buttons: controllers 32 to 39
M buttons: controllers 48 to 55
```

---

# LED renderer

Create a LED renderer responsible for displaying UI12 state on the active bank.

Inputs:

```text
active bank
current mapping
resolved alias target
state store
controller contract
```

Output:

```text
MIDI OUT CC messages to nanoKONTROL2
```

## Mute LEDs

For each mapped visible strip:

```text
M LED = state["<target>.mute"]
```

Example:

```text
bank 1, f1 = i1
target = i.0
M1 LED = state["i.0.mute"]
```

## Solo LEDs

For each mapped visible strip:

```text
S LED = state["<target>.solo"]
```

Example:

```text
bank 1, f1 = i1
target = i.0
S1 LED = state["i.0.solo"]
```

## Empty strips

If a strip has no mapped target:

- S LED off
- M LED off

---

# Startup behavior

At startup:

1. Load mapping
2. Connect to UI12 websocket
3. Open MIDI input and output
4. Start listening to UI12 messages
5. Populate state store as UI12 feedback arrives
6. Render LEDs for the active bank

If initial state is incomplete, keep unknown LEDs off.

The system becomes accurate as UI12 feedback arrives.

---

# Reconnection behavior

When UI12 websocket reconnects:

1. Keep current mapping
2. Keep active bank if possible
3. Resume parsing UI12 feedback
4. Refresh state store from incoming messages
5. Force full LED render

LED state may be stale after reconnection, so always re-render after reconnect.

---

# Periodic LED recovery

Add a slow LED recovery loop.

Recommended interval:

```js
const LED_RECOVERY_INTERVAL_MS = 5000;
```

Every 5 seconds:

```text
state store + active bank + mapping → render all visible LEDs
```

This is not UI12 polling.

It only re-applies current known LED state to the nanoKONTROL2.

Purpose:

- recover missed MIDI OUT messages
- recover controller LED desync
- refresh LEDs after glitches
- improve live robustness

---

# Bank switching behavior

When the active bank changes:

1. Recompute S LEDs
2. Recompute M LEDs
3. Turn off LEDs for unmapped strips
4. Render all LEDs for the new active bank

LEDs always represent the active bank only.

---

# Suggested modules

Possible modules:

```text
runtime/ui12Parser.js
runtime/stateStore.js
runtime/midiOutput.js
runtime/ledRenderer.js
```

Use existing project structure if different.

Keep implementation simple.

---

# Acceptance criteria

This task is complete when:

1. Runtime can open MIDI OUT to nanoKONTROL2
2. UI12 mute feedback updates physical `M` LEDs
3. UI12 solo feedback updates physical `S` LEDs
4. Clicking mute/solo in UI12 web interface updates nanoKONTROL2 LEDs
5. Pressing physical mute/solo updates LEDs only after UI12 feedback is received
6. LEDs refresh on bank change
7. LEDs refresh every 5 seconds from local state store
8. LEDs refresh after websocket reconnection
9. Empty mappings have LEDs off
10. Stereo targets use only the left-side path
11. Existing control behavior remains unchanged

---

# Non-goals

Do not implement:

- R blinking
- fader mismatch detection
- soft takeover
- fast UI12 polling
- stereo OR/AND aggregation
- LED feedback for every UI12 parameter
- snapshot diff system
- motorized fader behavior

---

# Design summary

```text
nanoKONTROL2 controls are user intentions.
UI12 feedback is the truth.
nanoKONTROL2 LEDs display UI12 truth.
```

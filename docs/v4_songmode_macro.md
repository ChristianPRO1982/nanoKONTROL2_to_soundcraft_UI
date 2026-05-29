# V4 orientation — songMode macro for worship / liturgy use

## Context

The current runtime controls a Soundcraft UI12 from a Korg nanoKONTROL2 and is progressively adding UI12 feedback to nanoKONTROL2 LEDs.

V4 introduces a worship-oriented macro called:

```text
songMode
```

The primary use case is church live sound.

During songs, several singing microphones must be open.  
During liturgy, readings, prayers or spoken parts, these singing microphones must be muted quickly.

The `SET` button on the nanoKONTROL2 should control and display this macro state.

---

# Core principle

`songMode` is a deterministic mute macro.

It controls a configured group of UI12 targets.

Example group:

```text
songMode targets = chantre, choir, guitar vocal mic, ambient singing mic
```

The runtime must be able to:

- mute all configured songMode targets
- unmute all configured songMode targets
- display whether all songMode targets are currently muted
- update the `SET` LED from UI12 real state, not from local intention only

---

# Important UI / UX rule

The `SET` LED follows the same logic as mute LEDs.

```text
SET LED ON  = all songMode targets are muted
SET LED OFF = at least one songMode target is open
```

This is intentional.

A lit LED means the song microphone group is cut / safe / muted.

---

# Meaning

## SET LED ON

```text
All configured songMode targets are muted.
The system is in liturgy / spoken mode.
```

## SET LED OFF

```text
At least one configured songMode target is not muted.
The system is in song / open mode, or partially open.
```

---

# Button behavior

The `SET` button toggles the group based on the real UI12 state.

## If SET LED is ON

This means:

```text
all songMode targets are currently muted
```

Pressing `SET` must:

```text
unmute all songMode targets
```

Result:

```text
songs are open
SET LED should turn OFF after UI12 feedback confirms the state
```

## If SET LED is OFF

This means:

```text
at least one songMode target is currently open
```

Pressing `SET` must:

```text
mute all songMode targets
```

Result:

```text
song microphones are muted
SET LED should turn ON after UI12 feedback confirms the state
```

---

# UI12 remains the source of truth

The `SET` LED must not simply represent that the user pressed the `SET` button.

It must represent the real mute state of all configured songMode targets according to the UI12 state store.

The runtime must compute:

```text
SET LED ON = every songMode target has mute = 1 in UI12 state
SET LED OFF = at least one songMode target has mute = 0 or unknown
```

This means the `SET` LED must also update if the user manually mutes or unmutes the relevant channels.

---

# Manual mute / unmute behavior

If the user manually mutes all songMode targets from:

- the UI12 web interface
- another tablet
- nanoKONTROL2 mute buttons
- another bank
- any other UI12 control surface

then the runtime must detect the UI12 feedback and turn the `SET` LED ON.

If the user manually unmutes one of the songMode targets, then the runtime must detect the UI12 feedback and turn the `SET` LED OFF.

This is required.

The `SET` LED is a calculated state indicator.

---

# Partial state behavior

Example:

```text
songMode targets = i1, i2, i3

i1.mute = 1
i2.mute = 1
i3.mute = 0
```

Then:

```text
SET LED OFF
```

because not all targets are muted.

Pressing `SET` in this state must mute all configured targets:

```text
i1.mute = 1
i2.mute = 1
i3.mute = 1
```

After UI12 feedback confirms all targets are muted:

```text
SET LED ON
```

---

# Safety rule

`songMode` intentionally overrides manual mute states on configured targets.

If a channel belongs to songMode, pressing `SET` may change its mute state.

This is expected.

If the sound engineer wants to prevent a channel from becoming audible when songMode opens, the operational safety method is:

```text
lower that channel fader to 0
```

Do not implement a per-channel mute protection mechanism in V4.

Do not remember previous mute states.

Do not restore previous mute states.

The macro must be deterministic:

```text
SET ON state  = all configured songMode targets muted
SET OFF state = at least one configured songMode target open
```

---

# Configuration

The mapping configuration must be extended to declare songMode targets.

The exact mapping file contract is defined separately.

This V4 task must not invent a final mapping syntax if a contract file already exists.

The runtime needs only the normalized result:

```js
songMode: {
  enabled: true,
  targets: ["i1", "i2", "i3"]
}
```

or an equivalent internal representation.

Targets must be resolved through the existing alias / mapping resolver.

---

# Stereo simplification

For V4, keep the same stereo simplification as V3.

If a songMode target resolves to a stereo object, only the left-side path is used as the reference target.

Examples:

```text
line   → l.0
player → p.0
```

The runtime should trust UI12 to manage linked stereo behavior.

Do not implement left/right OR or AND aggregation in V4.

---

# State requirements

V4 depends on the UI12 state store introduced for LED feedback.

At minimum, the state store must provide:

```text
<target>.mute
```

Example:

```js
stateStore.get("i.0.mute");
stateStore.get("l.0.mute");
```

Unknown values should be treated as not fully muted for SET LED computation.

Therefore:

```text
unknown mute state → SET LED OFF
```

This avoids falsely indicating that all song microphones are muted.

---

# SET LED rendering

The runtime must know the MIDI controller number for the physical `SET` button LED.

If not already known, first add an exploration step to identify the controller.

Once known, add it to the nanoKONTROL2 controller contract.

Expected behavior:

```text
value 127 = SET LED on
value 0   = SET LED off
```

The SET LED must be rendered:

- after UI12 mute feedback
- after pressing SET
- after bank changes if LED refresh is global
- during periodic LED recovery
- after websocket reconnection

---

# Action flow

## Press SET when all targets are muted

```text
SET press
→ runtime reads state store
→ all targets are muted
→ runtime sends mute = 0 to every songMode target
→ UI12 confirms through SETD feedback
→ state store updates
→ SET LED turns OFF
```

## Press SET when at least one target is open

```text
SET press
→ runtime reads state store
→ at least one target is open or unknown
→ runtime sends mute = 1 to every songMode target
→ UI12 confirms through SETD feedback
→ state store updates
→ SET LED turns ON only if all targets are confirmed muted
```

---

# Implementation guidance

Add songMode as a runtime feature, not as hardcoded church-specific logic.

Recommended module:

```text
runtime/songMode.js
```

Responsibilities:

- load normalized songMode targets from config
- resolve targets through existing alias resolver
- compute whether all targets are muted
- decide what command to send on SET press
- expose current SET LED state
- request LED renderer update

Possible functions:

```js
isAllMuted()
handleSetPress()
renderSetLed()
getSongModeTargets()
```

Keep this module small and deterministic.

---

# Integration with LED renderer

The LED renderer should support a global LED outside the 8 strips:

```text
SET LED = songMode all-muted state
```

This must not interfere with:

- S LEDs
- M LEDs
- R blinking LEDs

The SET LED is global, not bank-specific.

---

# Integration with MIDI input

The runtime must handle the physical `SET` button press.

If the MIDI controller number is known:

```text
on SET pressed with value 127:
  songMode.handleSetPress()
```

Ignore release value `0`.

If the controller number is not known yet, add a TODO or exploration note.

---

# Integration with UI12 feedback

Any incoming UI12 mute change for a songMode target must trigger recalculation of the SET LED.

Example:

```text
SETD^i.0.mute^1
```

If `i.0` is part of songMode:

```text
recompute songMode all-muted state
render SET LED
```

A full LED recovery render should also include SET LED.

---

# Periodic recovery

If V3 LED recovery exists, include SET LED in the recovery loop.

Every 5 seconds:

```text
state store → compute songMode state → render SET LED
```

Do not poll UI12.

Only re-render from local state.

---

# Reconnection behavior

After UI12 websocket reconnection:

1. Keep configured songMode targets
2. Refresh state store from incoming UI12 feedback
3. Recompute songMode state
4. Render SET LED

If state is unknown after reconnection, SET LED should remain OFF until confirmed.

---

# Acceptance criteria

V4 songMode is complete when:

1. Runtime can load configured songMode targets
2. Pressing SET mutes all songMode targets if at least one is open
3. Pressing SET unmutes all songMode targets if all are muted
4. SET LED turns ON only when all songMode targets are confirmed muted by UI12 state
5. SET LED turns OFF when at least one songMode target is open or unknown
6. Manual mute of all songMode targets turns SET LED ON
7. Manual unmute of one songMode target turns SET LED OFF
8. SET LED is refreshed during periodic LED recovery
9. SET LED is refreshed after websocket reconnection
10. SET LED is independent from active bank
11. Existing S/M/R LED behavior remains unchanged
12. Existing mapping and transport behavior remains unchanged

---

# Non-goals

Do not implement:

- previous mute state memory
- per-channel protection
- automatic fader movement
- snapshot system
- complex church workflow engine
- left/right stereo aggregation
- songMode per bank
- multiple simultaneous songMode groups

Keep V4 focused on one global songMode macro.

---

# Design summary

```text
songMode is a global mute macro for worship songs.

SET LED ON means all configured song microphones are muted.
SET LED OFF means at least one configured song microphone is open.

The SET LED is computed from UI12 state.
Pressing SET forces the group to the opposite deterministic state.
```

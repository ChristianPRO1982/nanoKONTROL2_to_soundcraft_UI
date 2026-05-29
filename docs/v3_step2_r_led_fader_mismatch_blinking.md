# V3 step 2 — R LED fader mismatch blinking

## Context

This task is the second part of V3.

It assumes the runtime already has:

- UI12 feedback parsing
- local UI12 state store
- MIDI OUT to nanoKONTROL2
- LED renderer
- active bank awareness

This task adds a warning system using the unused `R` LEDs.

The goal is to indicate when a physical nanoKONTROL2 fader no longer matches the actual UI12 mix value.

---

# Core idea

The nanoKONTROL2 faders are not motorized.

Therefore:

```text
physical fader position
can differ from
UI12 actual mix value
```

The `R` LED should blink when the physical fader is out of sync with the UI12 value.

Meaning:

```text
R blinking = physical fader and UI12 mix value are not synchronized
R off      = physical fader and UI12 mix value are close enough
```

---

# Scope

Implement blinking for `R` buttons only.

Relevant controllers:

```text
R buttons: controllers 64 to 71
```

Do not change mute/solo LED behavior.

Do not implement soft takeover or value pickup blocking.

The fader must still send values normally as it does today.

---

# State required

The runtime needs two value sources.

## 1. Last physical fader value

Store the last known physical value for each fader.

Normalize MIDI value:

```js
normalized = midiValue / 127;
```

Example:

```js
physicalFaderValues[1] = 0.72;
physicalFaderValues[2] = 0.30;
```

## 2. UI12 mix value

Use the UI12 state store populated by websocket feedback.

Example:

```js
state["i.0.mix"] = 0.70;
```

The runtime must parse and store at least:

```text
*.mix
```

from UI12 feedback messages.

---

# Stereo simplification for this step

For V3 step 2, stereo targets use only the left-side path as reference.

Examples:

```text
line   → l.0.mix
player → p.0.mix
```

Do not implement OR / AND / average logic between left and right channels.

Trust UI12 to manage linked stereo behavior.

---

# Dirty comparison rule

For each visible physical strip:

1. Resolve mapped target
2. Resolve its reference UI12 mix path
3. Get latest physical fader value
4. Get latest UI12 mix value
5. Compare both values
6. Mark strip dirty or clean

Example:

```text
bank 1, f1 = i1
physical fader 1 = 0.80
state["i.0.mix"] = 0.50
diff = 0.30
R1 blinks
```

---

# Tolerance and hysteresis

Use hysteresis instead of a single threshold.

Recommended values:

```js
const FADER_DIRTY_THRESHOLD = 0.06;
const FADER_CLEAN_THRESHOLD = 0.04;
```

Behavior:

```text
if diff > 0.06:
  mark dirty

if diff < 0.04:
  mark clean

if diff is between 0.04 and 0.06:
  keep previous state
```

This avoids unstable blinking around a 5% threshold.

---

# Ways to stop blinking

There are only two valid ways to stop `R` blinking.

## 1. Physical fader moves close enough

When the physical fader moves and becomes close to the UI12 mix value:

```text
diff < clean threshold
```

then `R` stops blinking.

## 2. UI12 fader moves close enough

When UI12 mix value changes and becomes close to the physical fader value:

```text
diff < clean threshold
```

then `R` stops blinking.

Do not implement a manual clear button.

Do not make the physical `R` button clear the warning.

---

# Blink scheduler

Blinking requires a small scheduler.

This scheduler is only for LED animation.

It must not query UI12.

Recommended interval:

```js
const R_BLINK_INTERVAL_MS = 400;
```

Every tick:

```text
toggle blink phase
render R LEDs for dirty visible strips
```

If a strip is not dirty:

```text
R LED off
```

If a dirty target is not visible in the active bank:

```text
do not update any physical R LED for it until it becomes visible
```

---

# Dirty state across banks

Dirty state should be associated with logical targets, not only physical strips.

Example:

```text
i1 mix is dirty
```

If `i1` appears:

```text
bank 1, f1 = i1 → R1 blinks
bank 3, f5 = i1 → R5 blinks
```

If `i1` is not visible in the current bank, the dirty state remains stored silently.

---

# Bank switching behavior

When the active bank changes:

1. Recompute visible mapped targets
2. Recompute dirty/clean state for visible strips
3. Render R LEDs for the new active bank
4. Turn off R LEDs for empty strips

Do not carry physical R LED positions from the previous bank.

R LEDs always represent the active bank only.

---

# Relationship with UI12 feedback LEDs

This task must integrate with the existing LED renderer.

Recommended responsibilities:

- `S` LEDs show UI12 solo state
- `M` LEDs show UI12 mute state
- `R` LEDs show fader mismatch state

The renderer should avoid conflicting writes to the same controller.

---

# Suggested module

Possible new module:

```text
runtime/faderSync.js
```

Responsibilities:

- store physical fader values
- read UI12 mix values from state store
- resolve mapped target mix paths
- apply hysteresis
- expose dirty state to LED renderer

The LED renderer remains responsible for actual MIDI OUT.

---

# Initial unknown values

If either value is unknown:

```text
physical fader value unknown
or
UI12 mix value unknown
```

then do not blink.

Treat the strip as clean until both values are known.

This prevents false warnings at startup.

---

# Acceptance criteria

This task is complete when:

1. Runtime stores last known physical fader values
2. Runtime stores UI12 `*.mix` values from feedback
3. R LED blinks when physical fader and UI12 mix differ too much
4. R LED stops blinking when values become close again
5. Physical fader movement can stop blinking
6. UI12 fader movement can stop blinking
7. R blinking follows active bank mapping
8. Dirty state follows logical targets across banks
9. Empty strips have R LEDs off
10. Stereo targets use only left-side path
11. No fast UI12 polling is added
12. Existing mute/solo LED behavior remains unchanged

---

# Non-goals

Do not implement:

- soft takeover
- motorized behavior
- R button clear action
- snapshot diffing
- OR/AND stereo aggregation
- UI12 polling
- blocking fader sends until pickup

---

# Design summary

```text
R LED blinking is a warning.
It means the visible physical fader does not match the UI12 mix value.
The warning clears only when the values become close again.
```

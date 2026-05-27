# Help — `.map` Profiles

Create a profile in `ui12-midi/configs/` with a `.map` extension.

Minimal example:

```ini
[meta]
name = rehearsal

[bank:1]
f1 = i1
f2 = i2
f8 = master

[bank:2]
f1 = line
f2 = player
f6 = sub1
f7 = sub2
```

Rules:
- Allowed sections: `[meta]`, `[bank:N]` (`N >= 1`)
- Allowed strips: `f1` to `f8`
- Values: aliases defined in `docs/aliases.contract.json` (e.g. `i1`, `line`, `player`, `sub1`, `master`)
- Comments start with `#` or `;`

Usage:
1. Start the app from `ui12-midi/` with `npm start`
2. Select the profile from the displayed list
3. Empty input = profile `1`

Useful notes:
- The runtime automatically infers `mix/gain/mute/solo` from MIDI controls.
- If an alias does not support an action (e.g. `master` + `mute`), the action is ignored and a terminal warning is shown.

# ui12-diode: POC banc de hacks LED nanoKONTROL2

POC terminal pour tester des dizaines d’approches MIDI afin d’allumer la LED **Mute voie 1** du nanoKONTROL2.

## Objectif
- émission MIDI uniquement (pas d’écoute d’événements du contrôleur)
- exécution hack par hack avec validation humaine `y/n/s/q`
- arrêt immédiat au premier `y`
- journalisation JSONL automatique

## Fichiers
- `led-bench.js`: runner CLI interactif
- `hacks.catalog.js`: catalogue déclaratif des hacks (familles + messages)
- `logs/*.jsonl`: résultats d’exécution

## Dépendance MIDI
Le script charge `easymidi`:
1. depuis `node_modules` local si présent
2. sinon via fallback `../ui12-midi/node_modules/easymidi`

Si nécessaire:

```bash
cd ui12-diode
npm i easymidi
```

## Lancer

```bash
cd ui12-diode
node led-bench.js
```

Options:
- `--port <name>`: force un port MIDI OUT exact
- `--start-at <index>`: démarre à l’index 1-based du catalogue
- `--max <count>`: limite le nombre de hacks
- `--dry-run`: simulation sans envoi MIDI
- `--log-file <path>`: chemin JSONL de sortie
- `--help`: aide

Exemples:

```bash
node led-bench.js --dry-run --max 5
node led-bench.js --start-at 10 --max 12
node led-bench.js --port "nanoKONTROL2 1 CTRL"
```

## Port MIDI OUT
Ordre de sélection:
1. `--port` si fourni
2. premier port contenant `nanokontrol2` et `ctrl`
3. sinon sélection indexée via prompt

## Interaction live
Après chaque hack, répondre:
- `y`: la LED Mute 1 a réagi -> arrêt immédiat (succès)
- `n`: pas d’effet -> hack suivant
- `s`: skip -> hack suivant
- `q`: arrêt volontaire

## Format JSONL
Chaque ligne contient:
- `timestamp`
- `sessionId`
- `hackId`
- `family`
- `messages`
- `response`
- `notes`
- `elapsedMs`

## Sécurité
Politique POC non persistant:
- autorisé: `cc`, `noteon/noteoff`, `sysex` non persistant
- interdit dans ce banc: SysEx d’écriture de scène (`Scene Write Request`, dumps persistants)

## Familles de hacks incluses
- `preflight_native`
- `cc_mute1_channel_sweep`
- `cc_threshold_patterns`
- `native_bf_patterns`
- `note_hypothesis`

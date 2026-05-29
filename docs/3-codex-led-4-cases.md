# Guide Codex: 4 cas LED Mute1 (hack unique)

Ce document décrit comment exécuter les 4 cas de test LED avec le hack validé `pf-native-inreq-g0`.

## Contrainte port MIDI OUT

Utiliser **uniquement** ce port:

`nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 24:0`

## Prérequis

- Script: `ui12-diode/led-hack-single.js`
- Node.js installé
- nanoKONTROL2 connecté avec le port OUT ci-dessus visible

## Commande d’exécution (live)

```bash
cd /home/utilisateur/Documents/projects/perso/nanoKONTROL2_to_soundcraft_UI/ui12-diode
node led-hack-single.js --port "nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 24:0"
```

Après chaque cas, répondre dans le terminal:
- `y`: effet validé
- `n`: effet non validé
- `s`: skip
- `q`: arrêt immédiat (avec `OFF` final forcé)

## Hack de base (commun aux 4 cas)

Avant chaque cas, envoyer le preflight SysEx:

`F0 42 40 00 01 13 00 00 00 01 F7`

Puis piloter la LED Mute1 avec:
- `CC channel=15 controller=48 value=127` => ON
- `CC channel=15 controller=48 value=0` => OFF

## Cas 1: Flash

Objectif: flash bref visible.

Séquence:
1. Preflight SysEx
2. LED ON (`127`) pendant `200ms`
3. LED OFF (`0`)
4. Prompt `y/n/s/q`

## Cas 2: Allumé “définitif”

Objectif: laisser la LED allumée jusqu’à validation utilisateur.

Séquence:
1. Preflight SysEx
2. LED ON (`127`)
3. Prompt `y/n/s/q`
4. Auto-reset OFF (`0`) après réponse pour repartir proprement

## Cas 3: Éteindre

Objectif: forcer l’extinction.

Séquence:
1. Preflight SysEx
2. LED OFF (`0`)
3. Prompt `y/n/s/q`

## Cas 4: Clignotement

Objectif: 10 cycles à `0.4s ON / 0.2s OFF`.

Séquence:
1. Preflight SysEx
2. Répéter 10 fois:
   - LED ON (`127`) pendant `400ms`
   - LED OFF (`0`) pendant `200ms`
3. Prompt `y/n/s/q`

## Logging

Le script écrit un JSONL dans `ui12-diode/logs/` avec:
- `timestamp`
- `sessionId`
- `testId`
- `stepName`
- `messages`
- `response`
- `elapsedMs`
- `port`
- `dryRun`

Exécution avec fichier explicite:

```bash
node led-hack-single.js \
  --port "nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 24:0" \
  --log-file "./logs/led-hack-single-manual.jsonl"
```

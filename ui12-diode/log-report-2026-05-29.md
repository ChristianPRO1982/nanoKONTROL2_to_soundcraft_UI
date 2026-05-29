# Compte rendu logs LED (humain + exploitable par Codex)

Résultat principal: il y a **un succès confirmé** dans les logs.

- Session complète de 36 hacks (le **29 mai 2026**) : **0 succès**
  - Fichier: `led-bench-2026-05-29T13-09-35-134Z.jsonl`
- Session courte ensuite (le **29 mai 2026**) : **succès au 1er hack**
  - Fichier: `led-bench-2026-05-29T13-11-22-837Z.jsonl`

Hack gagnant (LED vue brièvement):
- `hackId`: `pf-native-inreq-g0`
- `family`: `preflight_native`
- `response`: `yes`
- Séquence envoyée:
  1. SysEx Native In request, global channel 0  
     `F0 42 40 00 01 13 00 00 00 01 F7`
  2. `CC ch=15 ctrl=48 val=127`
  3. `CC ch=15 ctrl=48 val=0`

Interprétation utile:
- Le combo “**requête Native In + pulse Mute1 sur ch15**” est actuellement la seule preuve positive.
- Les autres familles (`cc_sweep`, `threshold`, `native_bf_patterns`, `note_hypothesis`) ont été `no` dans la grande session.
- Le succès est **transitoire** (bref), donc la priorité est la reproductibilité/stabilité autour de ce hack précis.

Ce que Codex doit retenir pour la suite:
1. Prendre `pf-native-inreq-g0` comme **baseline**.
2. Lancer une campagne locale autour de ce pattern uniquement:
   - varier délais entre SysEx et CC (`50/100/200/400 ms`)
   - répéter le pulse (`on->off`, `on->off->on`)  
   - tester maintien ON (sans off immédiat)
3. Ne pas élargir à d’autres familles tant que ce baseline n’est pas rendu reproductible.

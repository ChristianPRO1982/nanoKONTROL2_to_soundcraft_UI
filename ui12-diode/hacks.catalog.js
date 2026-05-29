'use strict';

const MUTE1_CONTROLLER = 48;
const DEFAULT_MUTE1_NOTE = 48;

function ccMessage(channel, value, waitAfterMs = 120) {
  return {
    type: 'cc',
    controller: MUTE1_CONTROLLER,
    value,
    channel,
    waitAfterMs,
  };
}

function noteMessage(type, channel, note, velocity, waitAfterMs = 120) {
  return {
    type,
    channel,
    note,
    velocity,
    waitAfterMs,
  };
}

function sysexMessage(bytes, waitAfterMs = 200) {
  return {
    type: 'sysex',
    bytes,
    waitAfterMs,
  };
}

function buildNativeModeRequest(globalChannel, direction) {
  const qq = direction === 'in' ? 0x01 : 0x00;
  return [0xF0, 0x42, 0x40 + globalChannel, 0x00, 0x01, 0x13, 0x00, 0x00, 0x00, qq, 0xF7];
}

function buildModeRequest(globalChannel) {
  return [0xF0, 0x42, 0x40 + globalChannel, 0x00, 0x01, 0x13, 0x00, 0x1F, 0x12, 0x00, 0xF7];
}

function buildIdentityRequest() {
  return [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
}

function makePreflightNativeHacks() {
  const hacks = [];
  const requestChannels = [0, 1, 7, 15];
  const modeChannels = [0, 1, 15];

  requestChannels.forEach(globalChannel => {
    hacks.push({
      id: `pf-native-inreq-g${globalChannel}`,
      family: 'preflight_native',
      title: `Native mode IN request (g=${globalChannel}) + probe`,
      notes: 'SysEx non persistant: demande de bascule Native In puis pulse Mute1.',
      messages: [
        sysexMessage(buildNativeModeRequest(globalChannel, 'in'), 220),
        ccMessage(15, 0x7F, 130),
        ccMessage(15, 0x00, 90),
      ],
    });
  });

  requestChannels.forEach(globalChannel => {
    hacks.push({
      id: `pf-native-outreq-g${globalChannel}`,
      family: 'preflight_native',
      title: `Native mode OUT request (g=${globalChannel}) + probe`,
      notes: 'SysEx non persistant: demande Native Out puis pulse Mute1.',
      messages: [
        sysexMessage(buildNativeModeRequest(globalChannel, 'out'), 220),
        ccMessage(15, 0x7F, 130),
        ccMessage(15, 0x00, 90),
      ],
    });
  });

  modeChannels.forEach(globalChannel => {
    hacks.push({
      id: `pf-mode-req-g${globalChannel}`,
      family: 'preflight_native',
      title: `Mode request (g=${globalChannel}) + probe`,
      notes: 'SysEx non persistant: requête de mode puis test Mute1.',
      messages: [
        sysexMessage(buildModeRequest(globalChannel), 200),
        ccMessage(15, 0x7F, 120),
      ],
    });
  });

  hacks.push({
    id: 'pf-identity-request-any',
    family: 'preflight_native',
    title: 'Universal Identity Request + probe',
    notes: 'Réveil/sonde MIDI standard puis test Mute1.',
    messages: [
      sysexMessage(buildIdentityRequest(), 220),
      ccMessage(15, 0x7F, 120),
    ],
  });

  return hacks;
}

function makeCcChannelSweepHacks() {
  const channels = [0, 1, 2, 3, 7, 8, 14, 15];

  return channels.map(channel => ({
    id: `cc-mute1-ch${channel}-on127`,
    family: 'cc_mute1_channel_sweep',
    title: `CC sweep channel=${channel}, value=127`,
    notes: 'Envoi direct CC Mute1 sur canal donné.',
    messages: [ccMessage(channel, 0x7F, 150)],
  }));
}

function makeCcThresholdPatternHacks() {
  return [
    {
      id: 'cc-threshold-off40-on41-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC threshold ch15: 40 -> 41',
      notes: 'Bascule au seuil documenté Off<=40 / On>=41.',
      messages: [ccMessage(15, 0x28, 130), ccMessage(15, 0x29, 140)],
    },
    {
      id: 'cc-threshold-off0-on41-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC threshold ch15: 0 -> 41',
      notes: 'Off franc puis on minimal.',
      messages: [ccMessage(15, 0x00, 120), ccMessage(15, 0x29, 150)],
    },
    {
      id: 'cc-threshold-off64-on127-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC threshold ch15: 64 -> 127',
      notes: 'Teste une valeur off haute suivie d’un on max.',
      messages: [ccMessage(15, 0x40, 130), ccMessage(15, 0x7F, 150)],
    },
    {
      id: 'cc-threshold-pulse-41-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC pulse ch15: 41 -> 0 -> 41',
      notes: 'Pulse court pour déclencher une LED qui attend un front.',
      messages: [ccMessage(15, 0x29, 130), ccMessage(15, 0x00, 90), ccMessage(15, 0x29, 150)],
    },
    {
      id: 'cc-threshold-pulse-127-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC pulse ch15: 127 -> 0 -> 127',
      notes: 'Pulse max pour implémentations strictes.',
      messages: [ccMessage(15, 0x7F, 130), ccMessage(15, 0x00, 90), ccMessage(15, 0x7F, 150)],
    },
    {
      id: 'cc-threshold-on-only-41-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC on-only ch15: 41',
      notes: 'Certaines implémentations n’ont pas besoin d’off préalable.',
      messages: [ccMessage(15, 0x29, 160)],
    },
    {
      id: 'cc-threshold-on-only-127-ch15',
      family: 'cc_threshold_patterns',
      title: 'CC on-only ch15: 127',
      notes: 'Essai direct on max sans reset.',
      messages: [ccMessage(15, 0x7F, 160)],
    },
  ];
}

function makeNativeBfPatternHacks() {
  return [
    {
      id: 'native-bf30-41',
      family: 'native_bf_patterns',
      title: 'Native BF 30 value 41',
      notes: 'Équivalent BF 30 41 (canal 15 via CC ch=15).',
      messages: [ccMessage(15, 0x29, 170)],
    },
    {
      id: 'native-bf30-7f',
      family: 'native_bf_patterns',
      title: 'Native BF 30 value 127',
      notes: 'Équivalent BF 30 7F.',
      messages: [ccMessage(15, 0x7F, 170)],
    },
    {
      id: 'native-bf30-off-then-on',
      family: 'native_bf_patterns',
      title: 'Native BF 30: off->on',
      notes: 'Équivalent BF 30 00 puis BF 30 7F.',
      messages: [ccMessage(15, 0x00, 110), ccMessage(15, 0x7F, 170)],
    },
    {
      id: 'native-bf30-40-41',
      family: 'native_bf_patterns',
      title: 'Native BF 30: 40->41',
      notes: 'Validation fine du seuil 40/41 en mode natif.',
      messages: [ccMessage(15, 0x40, 110), ccMessage(15, 0x29, 170)],
    },
  ];
}

function makeNoteHypothesisHacks() {
  return [
    {
      id: 'note-hyp-ch0-on127',
      family: 'note_hypothesis',
      title: 'Note hypothesis ch0 note48 on127',
      notes: 'Cas assign type = Note sur canal 0.',
      messages: [noteMessage('noteon', 0, DEFAULT_MUTE1_NOTE, 0x7F, 180)],
    },
    {
      id: 'note-hyp-ch0-on127-off64',
      family: 'note_hypothesis',
      title: 'Note hypothesis ch0 note48 on/off',
      notes: 'Note on puis note off (velocity 64).',
      messages: [
        noteMessage('noteon', 0, DEFAULT_MUTE1_NOTE, 0x7F, 120),
        noteMessage('noteoff', 0, DEFAULT_MUTE1_NOTE, 0x40, 140),
      ],
    },
    {
      id: 'note-hyp-ch15-on127',
      family: 'note_hypothesis',
      title: 'Note hypothesis ch15 note48 on127',
      notes: 'Cas assign type = Note sur canal 15.',
      messages: [noteMessage('noteon', 15, DEFAULT_MUTE1_NOTE, 0x7F, 180)],
    },
    {
      id: 'note-hyp-ch15-on41',
      family: 'note_hypothesis',
      title: 'Note hypothesis ch15 note48 on41',
      notes: 'Teste un velocity minimal compatible seuil on.',
      messages: [noteMessage('noteon', 15, DEFAULT_MUTE1_NOTE, 0x29, 180)],
    },
    {
      id: 'note-hyp-ch15-on-off-zero',
      family: 'note_hypothesis',
      title: 'Note hypothesis ch15 note48 on127 then off0',
      notes: 'Séquence complète note on/off via velocity=0.',
      messages: [
        noteMessage('noteon', 15, DEFAULT_MUTE1_NOTE, 0x7F, 120),
        noteMessage('noteon', 15, DEFAULT_MUTE1_NOTE, 0x00, 140),
      ],
    },
  ];
}

function getHackCatalog() {
  return [
    ...makePreflightNativeHacks(),
    ...makeCcChannelSweepHacks(),
    ...makeCcThresholdPatternHacks(),
    ...makeNativeBfPatternHacks(),
    ...makeNoteHypothesisHacks(),
  ];
}

module.exports = {
  MUTE1_CONTROLLER,
  getHackCatalog,
};

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_LED_PREFLIGHT_SYSEX,
  MidiOutput,
  PREFERRED_NANOKONTROL2_OUTPUT,
  resolveMidiOutputName,
} = require('../runtime/midiOutput');

test('resolveMidiOutputName prefers explicit 24:0 then fallback by model', () => {
  const outputs = [
    'nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 20:0',
    PREFERRED_NANOKONTROL2_OUTPUT,
    'other-device',
  ];

  assert.equal(resolveMidiOutputName(outputs, PREFERRED_NANOKONTROL2_OUTPUT), PREFERRED_NANOKONTROL2_OUTPUT);
  assert.equal(resolveMidiOutputName(outputs, 'unknown'), outputs[0]);
  assert.equal(resolveMidiOutputName(['other-device'], 'unknown'), null);
});

test('MidiOutput sends CC with configured channel and preflight sysex', () => {
  const sent = [];
  const output = {
    send(type, payload) {
      sent.push({ type, payload });
    },
    close() {
      sent.push({ type: 'close' });
    },
  };

  const midiOutput = new MidiOutput({
    output,
    ledOutChannel: 15,
  });

  midiOutput.sendPreflight();
  midiOutput.sendCc(48, 127);
  midiOutput.close();

  assert.deepEqual(sent[0], { type: 'sysex', payload: DEFAULT_LED_PREFLIGHT_SYSEX });
  assert.deepEqual(sent[1], {
    type: 'cc',
    payload: { controller: 48, value: 127, channel: 15 },
  });
  assert.deepEqual(sent[2], { type: 'close' });
});

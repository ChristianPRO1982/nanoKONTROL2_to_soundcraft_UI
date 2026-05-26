const test = require('node:test');
const assert = require('node:assert/strict');

const { RuntimeEngine, scaleContinuousMidi } = require('../runtime/engine');

function makeContracts() {
  return {
    controller: {
      controllers: {
        faders: { mapping: { 1: 0 } },
        knobs: { mapping: { 1: 16 } },
        soloButtons: { mapping: { 1: 32 }, pressedValue: 127 },
        muteButtons: { mapping: { 1: 48 }, pressedValue: 127 },
        transport: { play: 41, stop: 42, previousTrack: 58, nextTrack: 59, cycle: 46 },
        bankNavigation: { markerLeft: 61, markerRight: 62 },
      },
    },
    ui12: {
      continuousRange: { min: 0, max: 1 },
      toggleValues: { off: 0, on: 1 },
      capabilitySuffix: { mix: 'mix', gain: 'gain', solo: 'solo', mute: 'mute' },
    },
    transport: {
      transportControls: {
        play: { type: 'raw', command: 'MEDIA_PLAY' },
        stop: { type: 'raw', command: 'MEDIA_STOP' },
        previousTrack: { type: 'raw', command: 'MEDIA_PREV' },
        nextTrack: { type: 'raw', command: 'MEDIA_NEXT' },
      },
      playModes: {
        path: 'settings.playMode',
        manual: { value: 0 },
        auto: { value: 3 },
      },
    },
  };
}

function makeProfile() {
  return {
    meta: { name: 'test' },
    banks: [
      {
        bankIndex: 1,
        strips: new Map([
          [1, { alias: 'i1', channels: ['i.0'], capabilities: new Set(['mix', 'gain', 'solo', 'mute']) }],
        ]),
      },
      {
        bankIndex: 2,
        strips: new Map([
          [1, { alias: 'master', channels: ['m'], capabilities: new Set(['mix']) }],
        ]),
      },
    ],
  };
}

function makeEngine() {
  const sentSet = [];
  const sentRaw = [];
  const logs = [];

  const wsClient = {
    start() {},
    sendSet(path, value) {
      sentSet.push({ path, value });
    },
    sendRaw(command) {
      sentRaw.push(command);
    },
  };

  const logger = {
    log(message) {
      logs.push(message);
    },
    error(message) {
      logs.push(`ERR:${message}`);
    },
  };

  const midiInput = { on() {} };

  const engine = new RuntimeEngine({
    contracts: makeContracts(),
    resolvedProfile: makeProfile(),
    midiInput,
    wsClient,
    logger,
  });

  return { engine, sentSet, sentRaw, logs };
}

test('scaleContinuousMidi maps MIDI range to float range', () => {
  assert.equal(scaleContinuousMidi(0, { min: 0, max: 1 }), 0);
  assert.equal(scaleContinuousMidi(127, { min: 0, max: 1 }), 1);
});

test('engine routes strip fader to mix SETD path', () => {
  const { engine, sentSet } = makeEngine();

  engine.handleCc({ controller: 0, value: 64 });

  assert.equal(sentSet.length, 1);
  assert.equal(sentSet[0].path, 'i.0.mix');
});

test('engine applies bank clamp and keeps transport global', () => {
  const { engine, sentRaw } = makeEngine();

  engine.handleCc({ controller: 61, value: 127 });
  assert.equal(engine.currentBank().bankIndex, 1);

  engine.handleCc({ controller: 62, value: 127 });
  assert.equal(engine.currentBank().bankIndex, 2);

  engine.handleCc({ controller: 41, value: 127 });
  assert.deepEqual(sentRaw, ['MEDIA_PLAY']);
});

test('engine blocks unsupported capabilities and warns once', () => {
  const { engine, sentSet, logs } = makeEngine();

  engine.handleCc({ controller: 62, value: 127 });
  engine.handleCc({ controller: 48, value: 127 });
  engine.handleCc({ controller: 48, value: 127 });

  assert.equal(sentSet.length, 0);
  assert.equal(logs.filter(line => line.includes('ne supporte pas mute')).length, 1);
});

test('engine toggles play mode manual/auto via cycle', () => {
  const { engine, sentSet } = makeEngine();

  engine.handleCc({ controller: 46, value: 127 });
  engine.handleCc({ controller: 46, value: 127 });

  assert.deepEqual(sentSet, [
    { path: 'settings.playMode', value: 3 },
    { path: 'settings.playMode', value: 0 },
  ]);
});

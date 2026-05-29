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

function makeEngine(profile = makeProfile(), options = {}) {
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
    clear() {
      logs.push('__CLEAR__');
    },
  };

  const midiInput = { on() {} };

  const engine = new RuntimeEngine({
    contracts: makeContracts(),
    resolvedProfile: profile,
    midiInput,
    wsClient,
    logger,
    uiMode: options.uiMode || 'debug',
  });

  return { engine, sentSet, sentRaw, logs };
}

function getLastRunScreen(logs) {
  const clearIndex = logs.lastIndexOf('__CLEAR__');
  if (clearIndex === -1) {
    return [];
  }
  return logs.slice(clearIndex + 1);
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

test('engine start logs profile banner before banks and without legacy config line', () => {
  const { engine, logs } = makeEngine();

  engine.start();

  const separator = '='.repeat(50);
  const topIndex = logs.indexOf(separator);
  const titleIndex = logs.indexOf('test');
  const bottomIndex = logs.indexOf(separator, topIndex + 1);
  const banksIndex = logs.indexOf('Banques actives: 1, 2');
  const bankLineIndex = logs.indexOf('=== BANK 1 ===');

  assert.notEqual(topIndex, -1);
  assert.notEqual(titleIndex, -1);
  assert.notEqual(bottomIndex, -1);
  assert.notEqual(banksIndex, -1);
  assert.notEqual(bankLineIndex, -1);
  assert.ok(topIndex < titleIndex);
  assert.ok(titleIndex < bottomIndex);
  assert.ok(bottomIndex < banksIndex);
  assert.ok(banksIndex < bankLineIndex);
  assert.equal(logs.some(line => line.startsWith('Config chargée:')), false);
});

test('engine profile header falls back to "sans nom" when meta name is absent', () => {
  const profileWithoutName = makeProfile();
  profileWithoutName.meta = {};
  const { engine, logs } = makeEngine(profileWithoutName);

  engine.logProfileHeader();

  assert.equal(logs.includes('sans nom'), true);
});

test('engine run mode renders compact screen and clears on actions', () => {
  const { engine, logs } = makeEngine(makeProfile(), { uiMode: 'run' });

  engine.start();
  const clearCountAfterStart = logs.filter(line => line === '__CLEAR__').length;
  assert.equal(clearCountAfterStart, 0);
  assert.equal(logs.includes('test'), true);
  assert.equal(logs.includes('=== BANK 1 ==='), true);

  engine.handleCc({ controller: 62, value: 127 });
  assert.equal(logs.includes('BANK 2'), true);
  assert.equal(logs.includes('BANK:2'), true);

  engine.onWsSendEvent({ type: 'set', status: 'sent', path: 'i.0.mix', value: 0.5 });
  assert.equal(logs.includes('SET i.0.mix:0.5'), true);

  const clearCountFinal = logs.filter(line => line === '__CLEAR__').length;
  assert.equal(clearCountFinal > clearCountAfterStart, true);
});

test('engine run mode renders faders ascii with separator just after gain line', () => {
  const { engine, logs, sentSet } = makeEngine(makeProfile(), { uiMode: 'run' });
  const rowSeparator = '|----|----|----|----|----|----|----|----|';

  engine.start();

  engine.handleCc({ controller: 16, value: 64 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });

  engine.handleCc({ controller: 32, value: 127 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });

  engine.handleCc({ controller: 48, value: 127 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });

  engine.handleCc({ controller: 0, value: 127 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });

  const screen = getLastRunScreen(logs);

  assert.equal(screen[0], 'test');
  assert.equal(screen[1], '='.repeat(50));
  assert.equal(screen[2], 'BANK 1');
  assert.equal(screen[3], '-'.repeat(50));
  assert.equal(screen[4].startsWith('SET i.0.mix:'), true);
  assert.equal(screen[5], '');
  assert.equal(screen[6], '');

  assert.equal(screen[7].includes('F1'), true);
  assert.equal(screen[7].includes('F8'), true);
  assert.equal(screen[8], rowSeparator);
  assert.equal(screen[9].includes('  5 '), true);
  assert.equal(screen[10], rowSeparator);
  assert.equal(screen[11].includes('  S '), true);
  assert.equal(screen[12].includes('  M '), true);
  assert.equal(screen[13], rowSeparator);
  assert.equal(screen[14], '|    |    |    |    |    |    |    |    |');
  assert.equal(screen[15].includes(' 10 '), true);
  assert.equal(screen[16], '|    |    |    |    |    |    |    |    |');
  assert.equal(screen[17], rowSeparator);
});

test('engine run mode keeps ascii state per bank', () => {
  const { engine, logs, sentSet } = makeEngine(makeProfile(), { uiMode: 'run' });

  engine.start();

  engine.handleCc({ controller: 0, value: 127 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });
  let screen = getLastRunScreen(logs);
  assert.equal(screen[2], 'BANK 1');
  assert.equal(screen[15].includes(' 10 '), true);

  engine.handleCc({ controller: 62, value: 127 });
  screen = getLastRunScreen(logs);
  assert.equal(screen[2], 'BANK 2');
  assert.equal(screen[9], '|    |    |    |    |    |    |    |    |');

  engine.handleCc({ controller: 0, value: 64 });
  engine.onWsSendEvent({
    type: 'set',
    status: 'sent',
    path: sentSet[sentSet.length - 1].path,
    value: sentSet[sentSet.length - 1].value,
  });
  screen = getLastRunScreen(logs);
  assert.equal(screen[15].includes('  5 '), true);

  engine.handleCc({ controller: 61, value: 127 });
  screen = getLastRunScreen(logs);
  assert.equal(screen[2], 'BANK 1');
  assert.equal(screen[15].includes(' 10 '), true);
});

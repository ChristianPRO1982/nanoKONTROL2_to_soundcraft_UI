const test = require('node:test');
const assert = require('node:assert/strict');

const { LedRenderer, resolveFeedbackChannel, toLedCcValue } = require('../runtime/ledRenderer');
const { StateStore } = require('../runtime/stateStore');

function makeControllerContract() {
  return {
    controllers: {
      soloButtons: {
        mapping: {
          1: 32,
          2: 33,
          3: 34,
          4: 35,
          5: 36,
          6: 37,
          7: 38,
          8: 39,
        },
      },
      muteButtons: {
        mapping: {
          1: 48,
          2: 49,
          3: 50,
          4: 51,
          5: 52,
          6: 53,
          7: 54,
          8: 55,
        },
      },
      recordButtons: {
        mapping: {
          1: 64,
          2: 65,
          3: 66,
          4: 67,
          5: 68,
          6: 69,
          7: 70,
          8: 71,
        },
      },
    },
  };
}

test('resolveFeedbackChannel picks left stereo side first', () => {
  assert.equal(resolveFeedbackChannel(['l.0', 'l.1']), 'l.0');
  assert.equal(resolveFeedbackChannel(['p.1', 'p.0']), 'p.0');
  assert.equal(resolveFeedbackChannel(['m']), 'm');
  assert.equal(resolveFeedbackChannel([]), null);
});

test('toLedCcValue maps toggle value to LED ON/OFF values', () => {
  assert.equal(toLedCcValue(1), 127);
  assert.equal(toLedCcValue(0), 0);
  assert.equal(toLedCcValue(2), 0);
});

test('ledRenderer renderFullBank sends S/M/R with preflight', () => {
  const stateStore = new StateStore();
  stateStore.set('i.0.solo', 1);
  stateStore.set('i.0.mute', 0);
  stateStore.set('l.0.solo', 0);
  stateStore.set('l.0.mute', 1);

  const sendCcCalls = [];
  let preflightCount = 0;
  const midiOutput = {
    sendPreflight() {
      preflightCount += 1;
    },
    sendCc(controller, value) {
      sendCcCalls.push({ controller, value });
    },
  };

  const bank = {
    bankIndex: 1,
    strips: new Map([
      [1, { alias: 'i1', channels: ['i.0'], capabilities: new Set(['mix', 'solo', 'mute']) }],
      [2, { alias: 'line', channels: ['l.0', 'l.1'], capabilities: new Set(['mix', 'solo', 'mute']) }],
      [3, { alias: 'master', channels: ['m'], capabilities: new Set(['mix']) }],
    ]),
  };

  const visibleDirtyByStrip = new Map([
    [1, true],
    [2, false],
    [3, true],
  ]);

  const renderer = new LedRenderer({
    midiOutput,
    controllerContract: makeControllerContract(),
  });

  renderer.renderFullBank({
    bank,
    stateStore,
    visibleDirtyByStrip,
    rBlinkPhaseOn: true,
  });

  assert.equal(preflightCount, 1);
  assert.equal(sendCcCalls.length, 24);

  assert.deepEqual(sendCcCalls[0], { controller: 32, value: 127 });
  assert.deepEqual(sendCcCalls[1], { controller: 48, value: 0 });
  assert.deepEqual(sendCcCalls[2], { controller: 64, value: 127 });

  assert.deepEqual(sendCcCalls[3], { controller: 33, value: 0 });
  assert.deepEqual(sendCcCalls[4], { controller: 49, value: 127 });
  assert.deepEqual(sendCcCalls[5], { controller: 65, value: 0 });

  assert.deepEqual(sendCcCalls[6], { controller: 34, value: 0 });
  assert.deepEqual(sendCcCalls[7], { controller: 50, value: 0 });
  assert.deepEqual(sendCcCalls[8], { controller: 66, value: 127 });
});

test('ledRenderer renderRBankBlink updates R only without preflight', () => {
  const sendCcCalls = [];
  let preflightCount = 0;

  const midiOutput = {
    sendPreflight() {
      preflightCount += 1;
    },
    sendCc(controller, value) {
      sendCcCalls.push({ controller, value });
    },
  };

  const bank = {
    bankIndex: 1,
    strips: new Map([
      [1, { alias: 'i1', channels: ['i.0'], capabilities: new Set(['mix']) }],
      [2, { alias: 'sub1', channels: ['s.0'], capabilities: new Set(['mix']) }],
      [3, { alias: 'fx1', channels: ['f.0'], capabilities: new Set(['mute']) }],
    ]),
  };

  const visibleDirtyByStrip = new Map([
    [1, true],
    [2, true],
    [3, true],
  ]);

  const renderer = new LedRenderer({
    midiOutput,
    controllerContract: makeControllerContract(),
  });

  renderer.renderRBankBlink({
    bank,
    visibleDirtyByStrip,
    rBlinkPhaseOn: false,
  });

  assert.equal(preflightCount, 0);
  assert.equal(sendCcCalls.length, 8);

  assert.deepEqual(sendCcCalls[0], { controller: 64, value: 0 });
  assert.deepEqual(sendCcCalls[1], { controller: 65, value: 0 });
  assert.deepEqual(sendCcCalls[2], { controller: 66, value: 0 });
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FaderSync,
  normalizePhysicalMidiValue,
  resolveReferenceChannel,
  resolveMixPathFromAssignment,
} = require('../runtime/faderSync');
const { StateStore } = require('../runtime/stateStore');

test('normalizePhysicalMidiValue converts MIDI 0..127 to 0..1', () => {
  assert.equal(normalizePhysicalMidiValue(0), 0);
  assert.equal(normalizePhysicalMidiValue(127), 1);
  assert.equal(normalizePhysicalMidiValue(64).toFixed(6), '0.503937');
});

test('resolveReferenceChannel and resolveMixPathFromAssignment prefer stereo left side', () => {
  assert.equal(resolveReferenceChannel(['l.1', 'l.0']), 'l.0');

  const assignment = {
    channels: ['l.1', 'l.0'],
    capabilities: new Set(['mix', 'mute']),
  };
  assert.equal(resolveMixPathFromAssignment(assignment), 'l.0.mix');
});

test('faderSync applies dirty/clean hysteresis and keeps middle range state', () => {
  const sync = new FaderSync({ dirtyThreshold: 0.06, cleanThreshold: 0.04 });
  const stateStore = new StateStore();
  const bank = {
    bankIndex: 1,
    strips: new Map([[1, { channels: ['i.0'], capabilities: new Set(['mix']) }]]),
  };

  sync.setPhysicalFaderValue(1, 127);

  stateStore.set('i.0.mix', 0.9);
  let dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(dirtyByStrip.get(1), true);

  stateStore.set('i.0.mix', 0.95);
  dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(dirtyByStrip.get(1), true);

  stateStore.set('i.0.mix', 0.98);
  dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(dirtyByStrip.get(1), false);
});

test('faderSync treats unknown physical or UI12 mix values as clean', () => {
  const sync = new FaderSync();
  const stateStore = new StateStore();
  const bank = {
    bankIndex: 1,
    strips: new Map([[1, { channels: ['i.0'], capabilities: new Set(['mix']) }]]),
  };

  let dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(dirtyByStrip.get(1), false);

  stateStore.set('i.0.mix', 0.2);
  dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(dirtyByStrip.get(1), false);

  sync.setPhysicalFaderValue(1, 10);
  dirtyByStrip = sync.recomputeVisibleDirtyByStrip({ bank, stateStore });
  assert.equal(typeof dirtyByStrip.get(1), 'boolean');
});

test('faderSync keeps hidden dirty state by mix path when target is not visible', () => {
  const sync = new FaderSync({ dirtyThreshold: 0.06, cleanThreshold: 0.04 });
  const stateStore = new StateStore();

  const bank1 = {
    bankIndex: 1,
    strips: new Map([[1, { channels: ['i.0'], capabilities: new Set(['mix']) }]]),
  };
  const bank2 = {
    bankIndex: 2,
    strips: new Map([[1, { channels: ['m'], capabilities: new Set(['mix']) }]]),
  };

  sync.setPhysicalFaderValue(1, 127);
  stateStore.set('i.0.mix', 0.5);
  sync.recomputeVisibleDirtyByStrip({ bank: bank1, stateStore });
  assert.equal(sync.getDirtyForMixPath('i.0.mix'), true);

  stateStore.set('m.mix', 1);
  sync.recomputeVisibleDirtyByStrip({ bank: bank2, stateStore });

  assert.equal(sync.getDirtyForMixPath('i.0.mix'), true);
});

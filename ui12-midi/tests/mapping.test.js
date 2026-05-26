const test = require('node:test');
const assert = require('node:assert/strict');

const { buildResolvedBanks, getCapabilityForControl } = require('../runtime/mapping');

test('buildResolvedBanks keeps valid aliases and drops invalid ones', () => {
  const parsedMap = {
    meta: { name: 'demo' },
    warnings: [],
    banks: new Map([
      [1, { 1: 'i1', 2: 'unknown' }],
      [2, { 1: 'missing' }],
    ]),
  };

  const aliases = {
    aliases: {
      i1: {
        channels: ['i.0'],
        capabilities: ['mix', 'gain', 'solo', 'mute'],
      },
    },
  };

  const resolved = buildResolvedBanks(parsedMap, aliases);

  assert.equal(resolved.banks.length, 1);
  assert.equal(resolved.banks[0].bankIndex, 1);
  assert.equal(resolved.banks[0].strips.get(1).alias, 'i1');
  assert.ok(resolved.warnings.some(w => w.includes('alias inconnu')));
  assert.ok(resolved.warnings.some(w => w.includes('aucun alias valide')));
});

test('getCapabilityForControl returns expected capability', () => {
  assert.equal(getCapabilityForControl('fader'), 'mix');
  assert.equal(getCapabilityForControl('knob'), 'gain');
  assert.equal(getCapabilityForControl('solo'), 'solo');
  assert.equal(getCapabilityForControl('mute'), 'mute');
  assert.equal(getCapabilityForControl('x'), null);
});

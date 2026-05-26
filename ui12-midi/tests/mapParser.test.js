const test = require('node:test');
const assert = require('node:assert/strict');

const { parseMapText } = require('../runtime/mapParser');

test('parseMapText parses meta and banks with comments', () => {
  const input = `
# comment
[meta]
name = demo

[bank:1]
f1 = i1
f2 = line

[bank:2]
f8 = master
`;

  const parsed = parseMapText(input, 'demo.map');

  assert.equal(parsed.meta.name, 'demo');
  assert.equal(parsed.banks.get(1)[1], 'i1');
  assert.equal(parsed.banks.get(1)[2], 'line');
  assert.equal(parsed.banks.get(2)[8], 'master');
  assert.deepEqual(parsed.warnings, []);
});

test('parseMapText warns and ignores invalid entries', () => {
  const input = `
foo = bar
[bank:x]
f1 = i1
[bank:1]
f9 = i1
f1 =
`;

  const parsed = parseMapText(input, 'bad.map');

  assert.equal(parsed.banks.size, 0);
  assert.ok(parsed.warnings.some(w => w.includes('hors section')));
  assert.ok(parsed.warnings.some(w => w.includes('section inconnue')));
  assert.ok(parsed.warnings.some(w => w.includes('strip invalide')));
  assert.ok(parsed.warnings.some(w => w.includes('alias vide')));
});

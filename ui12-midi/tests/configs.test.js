const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSelection } = require('../runtime/configs');

test('parseSelection defaults to first item on empty input', () => {
  assert.equal(parseSelection('', 3), 1);
  assert.equal(parseSelection('   ', 3), 1);
});

test('parseSelection validates range and numeric input', () => {
  assert.equal(parseSelection('2', 3), 2);
  assert.equal(parseSelection('0', 3), null);
  assert.equal(parseSelection('4', 3), null);
  assert.equal(parseSelection('x', 3), null);
});

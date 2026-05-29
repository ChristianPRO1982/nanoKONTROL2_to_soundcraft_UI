const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSetdLine, parseUi12Message } = require('../runtime/ui12Parser');

test('parseSetdLine parses SETD with and without socket.io prefix', () => {
  assert.deepEqual(parseSetdLine('SETD^i.0.mute^1'), {
    type: 'set',
    path: 'i.0.mute',
    value: 1,
  });

  assert.deepEqual(parseSetdLine('3:::SETD^i.0.solo^0'), {
    type: 'set',
    path: 'i.0.solo',
    value: 0,
  });
});

test('parseSetdLine ignores invalid payloads', () => {
  assert.equal(parseSetdLine('RAW^MEDIA_PLAY'), null);
  assert.equal(parseSetdLine('SETD^i.0.mute^x'), null);
  assert.equal(parseSetdLine('SETD^^1'), null);
});

test('parseUi12Message supports multiline payloads and ignores unsupported lines', () => {
  const events = parseUi12Message('SETD^i.0.mute^1\nPING\n3:::SETD^i.0.solo^0');

  assert.deepEqual(events, [
    { type: 'set', path: 'i.0.mute', value: 1 },
    { type: 'set', path: 'i.0.solo', value: 0 },
  ]);
});

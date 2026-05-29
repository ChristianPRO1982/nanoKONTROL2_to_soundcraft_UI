const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeUiMode, readUiModeFromEnv } = require('../runtime/uiMode');

test('normalizeUiMode maps prod to run and defaults to debug', () => {
  assert.equal(normalizeUiMode('run'), 'run');
  assert.equal(normalizeUiMode('prod'), 'run');
  assert.equal(normalizeUiMode('debug'), 'debug');
  assert.equal(normalizeUiMode('unknown'), 'debug');
  assert.equal(normalizeUiMode(''), 'debug');
});

test('readUiModeFromEnv reads UI_MODE and normalizes', () => {
  assert.equal(readUiModeFromEnv({ UI_MODE: 'run' }), 'run');
  assert.equal(readUiModeFromEnv({ UI_MODE: 'prod' }), 'run');
  assert.equal(readUiModeFromEnv({ UI_MODE: 'debug' }), 'debug');
  assert.equal(readUiModeFromEnv({}), 'debug');
});

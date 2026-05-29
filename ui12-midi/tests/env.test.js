const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseEnvText, applyEnvValues, loadEnvFile } = require('../runtime/env');

test('parseEnvText supports comments, export and quoted values', () => {
  const parsed = parseEnvText(`
# comment
UI_MODE=run
export UI12_HOST="10.10.1.1"
EMPTY=
  `);

  assert.deepEqual(parsed, {
    UI_MODE: 'run',
    UI12_HOST: '10.10.1.1',
    EMPTY: '',
  });
});

test('applyEnvValues keeps existing keys unless override=true', () => {
  const env = { UI_MODE: 'debug' };
  applyEnvValues({ UI_MODE: 'run', FOO: 'bar' }, env, false);
  assert.deepEqual(env, { UI_MODE: 'debug', FOO: 'bar' });

  applyEnvValues({ UI_MODE: 'run' }, env, true);
  assert.equal(env.UI_MODE, 'run');
});

test('loadEnvFile loads values from disk into provided env object', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui12-env-'));
  const envFile = path.join(tempDir, '.env');
  fs.writeFileSync(envFile, 'UI_MODE=run\nUI12_HOST=127.0.0.1\n', 'utf8');

  const env = {};
  const loaded = loadEnvFile(envFile, { env });

  assert.equal(loaded, true);
  assert.equal(env.UI_MODE, 'run');
  assert.equal(env.UI12_HOST, '127.0.0.1');
});

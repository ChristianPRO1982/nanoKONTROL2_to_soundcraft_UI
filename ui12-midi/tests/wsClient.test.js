const test = require('node:test');
const assert = require('node:assert/strict');

const { Ui12WsClient } = require('../runtime/wsClient');

function makeClient(options = {}) {
  const logs = [];
  const events = [];

  const client = new Ui12WsClient({
    host: '127.0.0.1',
    connection: {
      websocketPath: '/socket',
      keepAliveMessage: '2::',
      keepAliveIntervalMs: 5000,
      setPrefix: 'SET^',
      rawPrefix: 'RAW^',
    },
    logger: {
      log(message) {
        logs.push(message);
      },
      error(message) {
        logs.push(`ERR:${message}`);
      },
    },
    onSendEvent(event) {
      events.push(event);
    },
    uiMode: options.uiMode || 'debug',
  });

  return { client, logs, events };
}

test('wsClient emits skipped events and keeps debug logs when closed', () => {
  const { client, logs, events } = makeClient();

  client.sendSet('i.0.mix', 0.5);
  client.sendRaw('MEDIA_PLAY');

  assert.deepEqual(events, [
    { type: 'set', status: 'skipped', path: 'i.0.mix', value: 0.5 },
    { type: 'raw', status: 'skipped', command: 'MEDIA_PLAY' },
  ]);
  assert.equal(logs.some(line => line.includes('WS indisponible, SET ignoré: i.0.mix=0.5')), true);
  assert.equal(logs.some(line => line.includes('WS indisponible, RAW ignoré: MEDIA_PLAY')), true);
});

test('wsClient emits sent events when websocket is open', () => {
  const { client, events } = makeClient();
  const payloads = [];

  client._ws = {
    readyState: 1,
    send(payload) {
      payloads.push(payload);
    },
  };

  client.sendSet('i.0.mix', 0.75);
  client.sendRaw('MEDIA_STOP');

  assert.deepEqual(events, [
    { type: 'set', status: 'sent', path: 'i.0.mix', value: 0.75 },
    { type: 'raw', status: 'sent', command: 'MEDIA_STOP' },
  ]);
  assert.deepEqual(payloads, ['SET^i.0.mix^0.75', 'RAW^MEDIA_STOP']);
});

test('wsClient suppresses verbose logs in run mode while still emitting events', () => {
  const { client, logs, events } = makeClient({ uiMode: 'run' });

  client.sendSet('i.0.mix', 0.4);
  client.sendRaw('MEDIA_PLAY');

  assert.deepEqual(events, [
    { type: 'set', status: 'skipped', path: 'i.0.mix', value: 0.4 },
    { type: 'raw', status: 'skipped', command: 'MEDIA_PLAY' },
  ]);
  assert.equal(logs.length, 0);
});

const WebSocket = require('ws');
const { normalizeUiMode } = require('./uiMode');

class Ui12WsClient {
  constructor(options) {
    this.host = options.host;
    this.connection = options.connection;
    this.logger = options.logger || console;
    this.uiMode = normalizeUiMode(options.uiMode);
    this.onSendEvent = options.onSendEvent || null;
    this.reconnectDelayMs = options.reconnectDelayMs || 2000;

    this._ws = null;
    this._closing = false;
    this._keepAliveTimer = null;
  }

  setSendEventHandler(handler) {
    this.onSendEvent = typeof handler === 'function' ? handler : null;
  }

  shouldLogVerbose() {
    return this.uiMode === 'debug';
  }

  _emitSendEvent(event) {
    if (typeof this.onSendEvent === 'function') {
      this.onSendEvent(event);
    }
  }

  get isOpen() {
    return this._ws && this._ws.readyState === WebSocket.OPEN;
  }

  start() {
    this._closing = false;
    this._connect();
  }

  stop() {
    this._closing = true;
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }

    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }

  _connect() {
    const url = `ws://${this.host}${this.connection.websocketPath}`;
    this._ws = new WebSocket(url);

    this._ws.on('open', () => {
      if (this.shouldLogVerbose()) {
        this.logger.log(`UI12 websocket connecté (${this.host})`);
      }
      this._startKeepAlive();
    });

    this._ws.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer ? reasonBuffer.toString() : '';
      if (this.shouldLogVerbose()) {
        this.logger.log(`UI12 websocket déconnecté code=${code} reason=${reason}`);
      }
      if (this._keepAliveTimer) {
        clearInterval(this._keepAliveTimer);
        this._keepAliveTimer = null;
      }

      if (!this._closing) {
        setTimeout(() => this._connect(), this.reconnectDelayMs);
      }
    });

    this._ws.on('error', error => {
      if (this.shouldLogVerbose()) {
        this.logger.error(`UI12 websocket erreur: ${error.message}`);
      }
    });
  }

  _startKeepAlive() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
    }

    this._keepAliveTimer = setInterval(() => {
      if (this.isOpen) {
        this._ws.send(this.connection.keepAliveMessage);
      }
    }, this.connection.keepAliveIntervalMs);
  }

  sendSet(path, value) {
    if (!this.isOpen) {
      this._emitSendEvent({ type: 'set', status: 'skipped', path, value });
      if (this.shouldLogVerbose()) {
        this.logger.log(`WS indisponible, SET ignoré: ${path}=${value}`);
      }
      return;
    }

    this._emitSendEvent({ type: 'set', status: 'sent', path, value });
    this._ws.send(`${this.connection.setPrefix}${path}^${value}`);
  }

  sendRaw(command) {
    if (!this.isOpen) {
      this._emitSendEvent({ type: 'raw', status: 'skipped', command });
      if (this.shouldLogVerbose()) {
        this.logger.log(`WS indisponible, RAW ignoré: ${command}`);
      }
      return;
    }

    this._emitSendEvent({ type: 'raw', status: 'sent', command });
    this._ws.send(`${this.connection.rawPrefix}${command}`);
  }
}

module.exports = {
  Ui12WsClient,
};

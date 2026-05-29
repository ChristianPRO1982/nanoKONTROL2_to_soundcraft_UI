const { buildControllerLayout } = require('./controller');
const { getCapabilityForControl } = require('./mapping');
const { normalizeUiMode } = require('./uiMode');

function scaleContinuousMidi(value, range) {
  const ratio = Number(value) / 127;
  const scaled = range.min + ratio * (range.max - range.min);
  return Number(scaled.toFixed(6));
}

function toDisplayInt(value) {
  const scaled = Math.floor(Number(value) * 10);
  return Math.max(0, Math.min(10, scaled));
}

class RuntimeEngine {
  constructor({ contracts, resolvedProfile, midiInput, wsClient, logger = console, uiMode = 'debug' }) {
    this.contracts = contracts;
    this.profile = resolvedProfile;
    this.midiInput = midiInput;
    this.wsClient = wsClient;
    this.logger = logger;

    this.layout = buildControllerLayout(contracts.controller);
    this.ui12 = contracts.ui12;
    this.transport = contracts.transport;
    this.uiMode = normalizeUiMode(uiMode);

    this.bankPosition = 0;
    this.autoPlayMode = false;
    this.toggleStates = new Map();
    this.warnedUnsupported = new Set();
    this.lastRunAction = 'INIT:READY';
    this.runDisplayStateByBank = new Map();
  }

  start() {
    this.logProfileHeader();
    this.logger.log(`Banques actives: ${this.profile.banks.map(bank => bank.bankIndex).join(', ')}`);

    this.wsClient.start();

    this.midiInput.on('cc', msg => {
      this.handleCc(msg);
    });

    this.logBank();
  }

  logProfileHeader() {
    const profileName = this.profile.meta.name || 'sans nom';
    const separator = '='.repeat(50);
    this.logger.log('');
    this.logger.log(separator);
    this.logger.log(profileName);
    this.logger.log(separator);
    this.logger.log('');
  }

  handleCc(msg) {
    if (this.handleBankNavigation(msg)) {
      return;
    }

    if (this.handleTransport(msg)) {
      return;
    }

    this.handleStripControl(msg);
  }

  currentBank() {
    return this.profile.banks[this.bankPosition];
  }

  logBank() {
    this.logger.log(`=== BANK ${this.currentBank().bankIndex} ===`);
  }

  renderRunScreen(actionText) {
    this.lastRunAction = actionText || this.lastRunAction;
    this.clearOutput();

    const profileName = this.profile.meta.name || 'sans nom';
    const bankLabel = `BANK ${this.currentBank().bankIndex}`;
    this.logger.log(profileName);
    this.logger.log('='.repeat(50));
    this.logger.log(bankLabel);
    this.logger.log('-'.repeat(50));
    this.logger.log(this.lastRunAction);
    this.logger.log('');
    this.logger.log('');
    this.renderRunFadersAscii();
  }

  renderRunFadersAscii() {
    const bank = this.currentBank();
    const bankState = this.ensureRunBankState(bank.bankIndex);
    const separator = this.renderAsciiSeparator();
    const labels = this.renderAsciiLabels();

    const gainRow = [];
    const soloRow = [];
    const muteRow = [];
    const faderRow = [];
    const blankRow = [];

    for (let strip = 1; strip <= 8; strip += 1) {
      const assignment = bank.strips.get(strip);
      const state = bankState.get(strip);
      const capabilities = assignment ? assignment.capabilities : null;

      const hasGain = capabilities ? capabilities.has('gain') : false;
      const hasSolo = capabilities ? capabilities.has('solo') : false;
      const hasMute = capabilities ? capabilities.has('mute') : false;
      const hasMix = capabilities ? capabilities.has('mix') : false;

      gainRow.push(hasGain ? this.formatIntCell(state.gainInt) : '    ');
      soloRow.push(hasSolo ? this.formatToggleCell(state.soloOn, 'S') : '    ');
      muteRow.push(hasMute ? this.formatToggleCell(state.muteOn, 'M') : '    ');
      faderRow.push(hasMix ? this.formatIntCell(state.faderInt) : '    ');
      blankRow.push('    ');
    }

    this.logger.log(labels);
    this.logger.log(separator);
    this.logger.log(this.renderAsciiRow(gainRow));
    this.logger.log(separator);
    this.logger.log(this.renderAsciiRow(soloRow));
    this.logger.log(this.renderAsciiRow(muteRow));
    this.logger.log(separator);
    this.logger.log(this.renderAsciiRow(blankRow));
    this.logger.log(this.renderAsciiRow(faderRow));
    this.logger.log(this.renderAsciiRow(blankRow));
    this.logger.log(separator);
  }

  renderAsciiLabels() {
    const labels = [];
    for (let strip = 1; strip <= 8; strip += 1) {
      labels.push(`F${strip}`.padEnd(4, ' '));
    }
    return ` ${labels.join(' ')}`;
  }

  renderAsciiSeparator() {
    return `|${Array(8).fill('----').join('|')}|`;
  }

  renderAsciiRow(cells) {
    return `|${cells.join('|')}|`;
  }

  formatIntCell(value) {
    if (value === null || value === undefined) {
      return '    ';
    }
    return ` ${String(value).padStart(2, ' ')} `;
  }

  formatToggleCell(isOn, marker) {
    if (!isOn) {
      return '    ';
    }
    return `  ${marker} `;
  }

  ensureRunBankState(bankIndex) {
    if (!this.runDisplayStateByBank.has(bankIndex)) {
      const initial = new Map();
      for (let strip = 1; strip <= 8; strip += 1) {
        initial.set(strip, {
          gainInt: null,
          faderInt: null,
          soloOn: false,
          muteOn: false,
        });
      }
      this.runDisplayStateByBank.set(bankIndex, initial);
    }

    return this.runDisplayStateByBank.get(bankIndex);
  }

  updateRunDisplayState({ bankIndex, strip, controlType, value, toggleState }) {
    const stripState = this.ensureRunBankState(bankIndex).get(strip);
    if (!stripState) {
      return;
    }

    if (controlType === 'knob') {
      stripState.gainInt = toDisplayInt(value);
      return;
    }

    if (controlType === 'fader') {
      stripState.faderInt = toDisplayInt(value);
      return;
    }

    if (controlType === 'solo') {
      stripState.soloOn = Boolean(toggleState);
      return;
    }

    if (controlType === 'mute') {
      stripState.muteOn = Boolean(toggleState);
    }
  }

  clearOutput() {
    if (typeof this.logger.clear === 'function') {
      this.logger.clear();
      return;
    }

    if (typeof console.clear === 'function') {
      console.clear();
    }
  }

  publishAction(actionText) {
    if (this.uiMode === 'run') {
      this.renderRunScreen(actionText);
    }
  }

  onWsSendEvent(event) {
    if (this.uiMode !== 'run' || !event) {
      return;
    }

    if (event.type === 'set') {
      const prefix = event.status === 'sent' ? 'SET' : 'SET_SKIPPED';
      this.publishAction(`${prefix} ${event.path}:${event.value}`);
      return;
    }

    if (event.type === 'raw') {
      const prefix = event.status === 'sent' ? 'RAW' : 'RAW_SKIPPED';
      this.publishAction(`${prefix} ${event.command}`);
    }
  }

  handleBankNavigation(msg) {
    if (msg.value !== this.layout.togglePressedValue) {
      return false;
    }

    if (msg.controller === this.layout.bankNavigation.leftCc) {
      this.bankPosition = Math.max(0, this.bankPosition - 1);
      if (this.uiMode === 'run') {
        this.publishAction(`BANK:${this.currentBank().bankIndex}`);
      } else {
        this.logBank();
      }
      return true;
    }

    if (msg.controller === this.layout.bankNavigation.rightCc) {
      this.bankPosition = Math.min(this.profile.banks.length - 1, this.bankPosition + 1);
      if (this.uiMode === 'run') {
        this.publishAction(`BANK:${this.currentBank().bankIndex}`);
      } else {
        this.logBank();
      }
      return true;
    }

    return false;
  }

  handleTransport(msg) {
    const action = this.layout.transportByCc.get(msg.controller);
    if (!action || msg.value !== this.layout.togglePressedValue) {
      return false;
    }

    if (action === 'cycle') {
      this.autoPlayMode = !this.autoPlayMode;
      const modeKey = this.autoPlayMode ? 'auto' : 'manual';
      const modeDef = this.transport.playModes[modeKey];
      this.wsClient.sendSet(this.transport.playModes.path, modeDef.value);
      if (this.uiMode === 'run') {
        this.publishAction(`MODE:${modeKey.toUpperCase()}`);
      } else {
        this.logger.log(`Player mode: ${modeKey.toUpperCase()}`);
      }
      return true;
    }

    const commandDef = this.transport.transportControls[action];
    if (!commandDef || commandDef.type !== 'raw') {
      this.logger.error(`Transport non supporté: ${action}`);
      return true;
    }

    this.wsClient.sendRaw(commandDef.command);
    if (this.uiMode === 'run') {
      this.publishAction(`RAW ${commandDef.command}`);
    } else {
      this.logger.log(`Player: ${commandDef.command}`);
    }
    return true;
  }

  handleStripControl(msg) {
    let controlType = null;
    let strip = null;

    if (this.layout.faderByCc.has(msg.controller)) {
      controlType = 'fader';
      strip = this.layout.faderByCc.get(msg.controller);
    } else if (this.layout.knobByCc.has(msg.controller)) {
      controlType = 'knob';
      strip = this.layout.knobByCc.get(msg.controller);
    } else if (this.layout.soloByCc.has(msg.controller)) {
      controlType = 'solo';
      strip = this.layout.soloByCc.get(msg.controller);
    } else if (this.layout.muteByCc.has(msg.controller)) {
      controlType = 'mute';
      strip = this.layout.muteByCc.get(msg.controller);
    }

    if (!controlType) {
      return;
    }

    const assignment = this.currentBank().strips.get(strip);
    if (!assignment) {
      return;
    }

    const capability = getCapabilityForControl(controlType);
    if (!capability) {
      return;
    }

    if (!assignment.capabilities.has(capability)) {
      this.warnCapability(assignment.alias, capability, this.currentBank().bankIndex, strip);
      return;
    }

    let value;
    let toggleState = null;
    if (controlType === 'fader' || controlType === 'knob') {
      value = scaleContinuousMidi(msg.value, this.ui12.continuousRange);
    } else {
      if (msg.value !== this.layout.togglePressedValue) {
        return;
      }

      const toggleKey = `${assignment.alias}:${capability}`;
      const nextState = !this.toggleStates.get(toggleKey);
      this.toggleStates.set(toggleKey, nextState);
      toggleState = nextState;
      value = nextState ? this.ui12.toggleValues.on : this.ui12.toggleValues.off;
    }

    this.updateRunDisplayState({
      bankIndex: this.currentBank().bankIndex,
      strip,
      controlType,
      value,
      toggleState,
    });

    const suffix = this.ui12.capabilitySuffix[capability] || capability;
    assignment.channels.forEach(channel => {
      this.wsClient.sendSet(`${channel}.${suffix}`, value);
    });
  }

  warnCapability(alias, capability, bankIndex, strip) {
    const warningKey = `${alias}:${capability}`;
    if (this.warnedUnsupported.has(warningKey)) {
      return;
    }

    this.warnedUnsupported.add(warningKey);
    this.logger.log(
      `Warning: bank ${bankIndex} f${strip} alias ${alias} ne supporte pas ${capability} (action ignorée)`
    );
  }
}

module.exports = {
  RuntimeEngine,
  scaleContinuousMidi,
};

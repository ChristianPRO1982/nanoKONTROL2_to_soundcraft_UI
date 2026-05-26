const { buildControllerLayout } = require('./controller');
const { getCapabilityForControl } = require('./mapping');

function scaleContinuousMidi(value, range) {
  const ratio = Number(value) / 127;
  const scaled = range.min + ratio * (range.max - range.min);
  return Number(scaled.toFixed(6));
}

class RuntimeEngine {
  constructor({ contracts, resolvedProfile, midiInput, wsClient, logger = console }) {
    this.contracts = contracts;
    this.profile = resolvedProfile;
    this.midiInput = midiInput;
    this.wsClient = wsClient;
    this.logger = logger;

    this.layout = buildControllerLayout(contracts.controller);
    this.ui12 = contracts.ui12;
    this.transport = contracts.transport;

    this.bankPosition = 0;
    this.autoPlayMode = false;
    this.toggleStates = new Map();
    this.warnedUnsupported = new Set();
  }

  start() {
    const profileName = this.profile.meta.name || 'sans nom';
    this.logger.log(`Config chargée: ${profileName}`);
    this.logger.log(`Banques actives: ${this.profile.banks.map(bank => bank.bankIndex).join(', ')}`);

    this.wsClient.start();

    this.midiInput.on('cc', msg => {
      this.handleCc(msg);
    });

    this.logBank();
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

  handleBankNavigation(msg) {
    if (msg.value !== this.layout.togglePressedValue) {
      return false;
    }

    if (msg.controller === this.layout.bankNavigation.leftCc) {
      this.bankPosition = Math.max(0, this.bankPosition - 1);
      this.logBank();
      return true;
    }

    if (msg.controller === this.layout.bankNavigation.rightCc) {
      this.bankPosition = Math.min(this.profile.banks.length - 1, this.bankPosition + 1);
      this.logBank();
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
      this.logger.log(`Player mode: ${modeKey.toUpperCase()}`);
      return true;
    }

    const commandDef = this.transport.transportControls[action];
    if (!commandDef || commandDef.type !== 'raw') {
      this.logger.error(`Transport non supporté: ${action}`);
      return true;
    }

    this.wsClient.sendRaw(commandDef.command);
    this.logger.log(`Player: ${commandDef.command}`);
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
    if (controlType === 'fader' || controlType === 'knob') {
      value = scaleContinuousMidi(msg.value, this.ui12.continuousRange);
    } else {
      if (msg.value !== this.layout.togglePressedValue) {
        return;
      }

      const toggleKey = `${assignment.alias}:${capability}`;
      const nextState = !this.toggleStates.get(toggleKey);
      this.toggleStates.set(toggleKey, nextState);
      value = nextState ? this.ui12.toggleValues.on : this.ui12.toggleValues.off;
    }

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

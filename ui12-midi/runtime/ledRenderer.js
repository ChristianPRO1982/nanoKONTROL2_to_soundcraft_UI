function resolveFeedbackChannel(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return null;
  }

  const leftChannel = channels.find(channel => /\.0$/.test(channel));
  return leftChannel || channels[0];
}

function toLedCcValue(toggleValue) {
  return Number(toggleValue) === 1 ? 127 : 0;
}

function mapControllerByStrip(mappingObj = {}) {
  return new Map(Object.entries(mappingObj).map(([stripText, cc]) => [Number(stripText), Number(cc)]));
}

function isStripDirtyVisible(visibleDirtyByStrip, strip) {
  if (!visibleDirtyByStrip || typeof visibleDirtyByStrip.get !== 'function') {
    return false;
  }
  return visibleDirtyByStrip.get(strip) === true;
}

class LedRenderer {
  constructor({ midiOutput, controllerContract }) {
    this.midiOutput = midiOutput;

    const controllers = controllerContract.controllers || {};
    this.soloCcByStrip = mapControllerByStrip((controllers.soloButtons || {}).mapping);
    this.muteCcByStrip = mapControllerByStrip((controllers.muteButtons || {}).mapping);
    this.recordCcByStrip = mapControllerByStrip((controllers.recordButtons || {}).mapping);
  }

  renderFullBank({ bank, stateStore, visibleDirtyByStrip, rBlinkPhaseOn = true }) {
    if (!bank || !stateStore) {
      return;
    }

    this.midiOutput.sendPreflight();

    for (let strip = 1; strip <= 8; strip += 1) {
      const assignment = bank.strips.get(strip);

      let soloValue = 0;
      let muteValue = 0;
      let recordValue = 0;

      if (assignment) {
        const feedbackChannel = resolveFeedbackChannel(assignment.channels);
        if (feedbackChannel) {
          if (assignment.capabilities.has('solo')) {
            soloValue = toLedCcValue(stateStore.getToggle(`${feedbackChannel}.solo`));
          }

          if (assignment.capabilities.has('mute')) {
            muteValue = toLedCcValue(stateStore.getToggle(`${feedbackChannel}.mute`));
          }
        }

        const isDirty = assignment.capabilities.has('mix') && isStripDirtyVisible(visibleDirtyByStrip, strip);
        recordValue = isDirty && rBlinkPhaseOn ? 127 : 0;
      }

      this.midiOutput.sendCc(this.soloCcByStrip.get(strip), soloValue);
      this.midiOutput.sendCc(this.muteCcByStrip.get(strip), muteValue);
      this.midiOutput.sendCc(this.recordCcByStrip.get(strip), recordValue);
    }
  }

  renderRBankBlink({ bank, visibleDirtyByStrip, rBlinkPhaseOn = true }) {
    if (!bank) {
      return;
    }

    for (let strip = 1; strip <= 8; strip += 1) {
      const assignment = bank.strips.get(strip);
      const isDirty = Boolean(
        assignment &&
          assignment.capabilities &&
          assignment.capabilities.has('mix') &&
          isStripDirtyVisible(visibleDirtyByStrip, strip)
      );

      const recordValue = isDirty && rBlinkPhaseOn ? 127 : 0;
      this.midiOutput.sendCc(this.recordCcByStrip.get(strip), recordValue);
    }
  }

  renderBank(args) {
    this.renderFullBank(args);
  }
}

module.exports = {
  LedRenderer,
  isStripDirtyVisible,
  mapControllerByStrip,
  resolveFeedbackChannel,
  toLedCcValue,
};

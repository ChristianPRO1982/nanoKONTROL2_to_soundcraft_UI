const PREFERRED_NANOKONTROL2_OUTPUT = 'nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 24:0';

const DEFAULT_LED_PREFLIGHT_SYSEX = [240, 66, 64, 0, 1, 19, 0, 0, 0, 1, 247];

function clampMidiByte(value) {
  return Math.max(0, Math.min(127, Math.round(Number(value) || 0)));
}

function clampMidiChannel(value) {
  return Math.max(0, Math.min(15, Math.round(Number(value) || 0)));
}

function resolveMidiOutputName(midiOutputs, preferredName = PREFERRED_NANOKONTROL2_OUTPUT) {
  if (preferredName && midiOutputs.includes(preferredName)) {
    return preferredName;
  }

  const byModel = midiOutputs.find(name => name.toLowerCase().includes('nanokontrol2'));
  if (byModel) {
    return byModel;
  }

  return null;
}

class MidiOutput {
  constructor({ output, logger = console, ledOutChannel = 15, preflightSysex = DEFAULT_LED_PREFLIGHT_SYSEX }) {
    this.output = output;
    this.logger = logger;
    this.ledOutChannel = clampMidiChannel(ledOutChannel);
    this.preflightSysex = Array.isArray(preflightSysex)
      ? preflightSysex.map(value => Number(value))
      : DEFAULT_LED_PREFLIGHT_SYSEX;
  }

  sendPreflight() {
    this.sendSysex(this.preflightSysex);
  }

  sendSysex(bytes) {
    this.output.send('sysex', bytes);
  }

  sendCc(controller, value) {
    this.output.send('cc', {
      controller: clampMidiByte(controller),
      value: clampMidiByte(value),
      channel: clampMidiChannel(this.ledOutChannel),
    });
  }

  close() {
    if (this.output && typeof this.output.close === 'function') {
      this.output.close();
    }
  }
}

module.exports = {
  DEFAULT_LED_PREFLIGHT_SYSEX,
  MidiOutput,
  PREFERRED_NANOKONTROL2_OUTPUT,
  resolveMidiOutputName,
};

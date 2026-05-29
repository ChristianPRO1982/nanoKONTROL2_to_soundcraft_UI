function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric < 0) {
    return 0;
  }
  if (numeric > 1) {
    return 1;
  }
  return numeric;
}

function normalizePhysicalMidiValue(midiValue) {
  const numeric = Number(midiValue);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return clamp01(numeric / 127);
}

function resolveReferenceChannel(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return null;
  }

  const leftChannel = channels.find(channel => /\.0$/.test(channel));
  return leftChannel || channels[0];
}

function resolveMixPathFromAssignment(assignment) {
  if (!assignment || !assignment.capabilities || !assignment.capabilities.has('mix')) {
    return null;
  }

  const referenceChannel = resolveReferenceChannel(assignment.channels);
  if (!referenceChannel) {
    return null;
  }

  return `${referenceChannel}.mix`;
}

class FaderSync {
  constructor({ dirtyThreshold = 0.06, cleanThreshold = 0.04 } = {}) {
    this.dirtyThreshold = Number(dirtyThreshold);
    this.cleanThreshold = Number(cleanThreshold);

    this.physicalByStrip = new Map();
    this.dirtyByMixPath = new Map();
  }

  setPhysicalFaderValue(strip, midiValue) {
    const normalized = normalizePhysicalMidiValue(midiValue);
    if (normalized === null) {
      return;
    }

    this.physicalByStrip.set(Number(strip), normalized);
  }

  getPhysicalFaderValue(strip) {
    return this.physicalByStrip.get(Number(strip));
  }

  getDirtyForMixPath(mixPath) {
    return this.dirtyByMixPath.get(mixPath) === true;
  }

  applyHysteresis(mixPath, diff) {
    const previousDirty = this.getDirtyForMixPath(mixPath);

    if (diff > this.dirtyThreshold) {
      this.dirtyByMixPath.set(mixPath, true);
      return true;
    }

    if (diff < this.cleanThreshold) {
      this.dirtyByMixPath.set(mixPath, false);
      return false;
    }

    return previousDirty;
  }

  recomputeVisibleDirtyByStrip({ bank, stateStore }) {
    const visibleDirtyByStrip = new Map();

    for (let strip = 1; strip <= 8; strip += 1) {
      const assignment = bank && bank.strips ? bank.strips.get(strip) : null;
      const mixPath = resolveMixPathFromAssignment(assignment);

      if (!mixPath) {
        visibleDirtyByStrip.set(strip, false);
        continue;
      }

      const physical = this.getPhysicalFaderValue(strip);
      const uiMix = stateStore ? stateStore.get(mixPath, undefined) : undefined;

      if (!Number.isFinite(physical) || !Number.isFinite(uiMix)) {
        visibleDirtyByStrip.set(strip, false);
        continue;
      }

      const diff = Math.abs(physical - Number(uiMix));
      const isDirty = this.applyHysteresis(mixPath, diff);
      visibleDirtyByStrip.set(strip, isDirty);
    }

    return visibleDirtyByStrip;
  }
}

module.exports = {
  FaderSync,
  clamp01,
  normalizePhysicalMidiValue,
  resolveReferenceChannel,
  resolveMixPathFromAssignment,
};

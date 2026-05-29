class StateStore {
  constructor() {
    this.values = new Map();
  }

  set(path, value) {
    if (!path) {
      return;
    }
    this.values.set(String(path), Number(value));
  }

  get(path, fallback = undefined) {
    if (!path) {
      return fallback;
    }

    if (!this.values.has(path)) {
      return fallback;
    }

    return this.values.get(path);
  }

  getToggle(path) {
    const value = this.get(path, 0);
    return Number(value) === 1 ? 1 : 0;
  }
}

module.exports = {
  StateStore,
};

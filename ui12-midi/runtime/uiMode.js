function normalizeUiMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();

  if (mode === 'run' || mode === 'prod') {
    return 'run';
  }

  return 'debug';
}

function readUiModeFromEnv(env = process.env) {
  return normalizeUiMode(env.UI_MODE);
}

module.exports = {
  normalizeUiMode,
  readUiModeFromEnv,
};

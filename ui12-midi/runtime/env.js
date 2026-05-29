const fs = require('fs');

function parseEnvText(content) {
  const values = {};
  const lines = String(content || '').split(/\r?\n/);

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(normalizedLine);
    if (!match) {
      return;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
}

function applyEnvValues(values, env = process.env, override = false) {
  Object.entries(values).forEach(([key, value]) => {
    if (override || env[key] === undefined) {
      env[key] = value;
    }
  });
}

function loadEnvFile(filePath, options = {}) {
  const env = options.env || process.env;
  const override = options.override || false;

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseEnvText(content);
  applyEnvValues(parsed, env, override);
  return true;
}

module.exports = {
  parseEnvText,
  applyEnvValues,
  loadEnvFile,
};

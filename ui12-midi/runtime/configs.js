const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { parseMapText } = require('./mapParser');

function getConfigsDir() {
  return path.resolve(__dirname, '../configs');
}

function discoverMapFiles(configDir = getConfigsDir()) {
  if (!fs.existsSync(configDir)) {
    return [];
  }

  return fs
    .readdirSync(configDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.map'))
    .map(entry => ({
      name: entry.name,
      filePath: path.join(configDir, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseSelection(input, max) {
  const normalized = input.trim();
  if (!normalized) {
    return 1;
  }

  const numeric = Number(normalized);
  if (!Number.isInteger(numeric)) {
    return null;
  }

  if (numeric < 1 || numeric > max) {
    return null;
  }

  return numeric;
}

function askQuestion(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer));
  });
}

async function promptConfigSelection(configs, io = {}) {
  const input = io.input || process.stdin;
  const output = io.output || process.stdout;

  output.write('Configurations disponibles:\n');
  configs.forEach((config, idx) => {
    output.write(`  [${idx + 1}] ${config.name}\n`);
  });

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const answer = await askQuestion(rl, 'Choix config (Entrée = 1): ');
      const selected = parseSelection(answer, configs.length);
      if (selected !== null) {
        return configs[selected - 1];
      }
      output.write('Sélection invalide. Entre un index de la liste.\n');
    }
  } finally {
    rl.close();
  }
}

function loadMapConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseMapText(content, path.basename(filePath));
}

module.exports = {
  getConfigsDir,
  discoverMapFiles,
  parseSelection,
  promptConfigSelection,
  loadMapConfig,
};

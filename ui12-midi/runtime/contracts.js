const fs = require('fs');
const path = require('path');

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function loadContracts() {
  const docsDir = path.resolve(__dirname, '../../docs');

  const aliases = readJsonFile(path.join(docsDir, 'aliases.contract.json'));
  const controller = readJsonFile(path.join(docsDir, 'controller-nanokontrol2.contract.json'));
  const transport = readJsonFile(path.join(docsDir, 'transport.contract.json'));
  const ui12 = readJsonFile(path.join(docsDir, 'ui12.contract.json'));

  return { aliases, controller, transport, ui12 };
}

module.exports = {
  loadContracts,
};

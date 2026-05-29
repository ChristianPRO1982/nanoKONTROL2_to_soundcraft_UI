const easymidi = require('easymidi');
const path = require('path');

const { loadContracts } = require('./contracts');
const {
  discoverMapFiles,
  getConfigsDir,
  promptConfigSelection,
  loadMapConfig,
} = require('./configs');
const { buildResolvedBanks } = require('./mapping');
const { Ui12WsClient } = require('./wsClient');
const { RuntimeEngine } = require('./engine');
const { readUiModeFromEnv } = require('./uiMode');
const { loadEnvFile } = require('./env');

function resolveMidiInputName(midiInputs, defaultName) {
  if (defaultName && midiInputs.includes(defaultName)) {
    return defaultName;
  }

  const byModel = midiInputs.find(name => name.toLowerCase().includes('nanokontrol2'));
  if (byModel) {
    return byModel;
  }

  return null;
}

async function bootstrap(options = {}) {
  const logger = options.logger || console;
  loadEnvFile(path.resolve(__dirname, '../.env'), { override: true });
  const uiMode = readUiModeFromEnv();
  const contracts = loadContracts();

  const configFiles = discoverMapFiles(getConfigsDir());
  if (configFiles.length === 0) {
    throw new Error('Aucune configuration .map trouvée dans ui12-midi/configs');
  }

  const selectedConfig = await promptConfigSelection(configFiles, options.io);
  logger.log(`Config sélectionnée: ${selectedConfig.name}`);

  const parsedMap = loadMapConfig(selectedConfig.filePath);
  const resolvedProfile = buildResolvedBanks(parsedMap, contracts.aliases);
  if (!resolvedProfile.meta.name || !resolvedProfile.meta.name.trim()) {
    resolvedProfile.meta.name = selectedConfig.name;
  }

  resolvedProfile.warnings.forEach(warning => logger.log(`Warning: ${warning}`));

  if (resolvedProfile.banks.length === 0) {
    throw new Error('La configuration ne contient aucune banque exploitable');
  }

  const midiInputs = easymidi.getInputs();
  logger.log('Entrées MIDI détectées :');
  midiInputs.forEach((name, index) => logger.log(`  [${index}] ${name}`));

  const midiInputName = resolveMidiInputName(
    midiInputs,
    contracts.controller.device.defaultMidiInput || contracts.ui12.defaultMidiInput
  );

  if (!midiInputName) {
    throw new Error('nanoKONTROL2 introuvable. Branche le contrôleur puis relance.');
  }

  logger.log(`MIDI utilisé : ${midiInputName}`);
  const midiInput = new easymidi.Input(midiInputName);

  const ui12Host = process.env.UI12_HOST || contracts.ui12.connection.defaultHost;
  const wsClient = new Ui12WsClient({
    host: ui12Host,
    connection: contracts.ui12.connection,
    logger,
    uiMode,
  });

  const engine = new RuntimeEngine({
    contracts,
    resolvedProfile,
    midiInput,
    wsClient,
    logger,
    uiMode,
  });
  wsClient.setSendEventHandler(event => engine.onWsSendEvent(event));

  engine.start();

  return {
    engine,
    wsClient,
    midiInput,
    resolvedProfile,
  };
}

module.exports = {
  bootstrap,
  resolveMidiInputName,
};

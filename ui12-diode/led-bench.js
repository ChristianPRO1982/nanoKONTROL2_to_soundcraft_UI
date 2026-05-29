#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { getHackCatalog } = require('./hacks.catalog');

const HELP_TEXT = `
POC LED bench nanoKONTROL2 (Mute 1)

Usage:
  node led-bench.js [options]

Options:
  --port <name>        Force le port MIDI OUT exact
  --start-at <index>   Démarre au hack indexé (1-based). Défaut: 1
  --max <count>        Limite le nombre de hacks exécutés
  --dry-run            N'envoie rien en MIDI (simulation)
  --log-file <path>    Chemin du fichier JSONL de sortie
  --help               Affiche cette aide
`.trim();

function parsePositiveInt(raw, optionName) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} doit être un entier strictement positif`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    port: null,
    startAt: 1,
    max: null,
    dryRun: false,
    logFile: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`Option ${arg} sans valeur`);
      }
      i += 1;
      return argv[i];
    };

    if (arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--port') {
      options.port = next();
      continue;
    }
    if (arg.startsWith('--port=')) {
      options.port = arg.slice('--port='.length);
      continue;
    }
    if (arg === '--start-at') {
      options.startAt = parsePositiveInt(next(), '--start-at');
      continue;
    }
    if (arg.startsWith('--start-at=')) {
      options.startAt = parsePositiveInt(arg.slice('--start-at='.length), '--start-at');
      continue;
    }
    if (arg === '--max') {
      options.max = parsePositiveInt(next(), '--max');
      continue;
    }
    if (arg.startsWith('--max=')) {
      options.max = parsePositiveInt(arg.slice('--max='.length), '--max');
      continue;
    }
    if (arg === '--log-file') {
      options.logFile = next();
      continue;
    }
    if (arg.startsWith('--log-file=')) {
      options.logFile = arg.slice('--log-file='.length);
      continue;
    }

    throw new Error(`Option inconnue: ${arg}`);
  }

  return options;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(String(answer || '').trim()));
  });
}

function readPipedAnswers() {
  if (process.stdin.isTTY) {
    return Promise.resolve([]);
  }

  return new Promise(resolve => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      buffer += chunk;
    });
    process.stdin.on('end', () => {
      const answers = buffer
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      resolve(answers);
    });
    process.stdin.resume();
  });
}

function createPrompt(rl, pipedAnswers) {
  return async question => {
    if (pipedAnswers.length > 0) {
      const answer = pipedAnswers.shift();
      console.log(`${question}${answer}`);
      return answer;
    }

    if (!process.stdin.isTTY) {
      throw new Error(
        'Entrée standard épuisée en mode non-interactif. Fournis plus de réponses (y/n/s/q) dans le pipe.'
      );
    }

    return ask(rl, question);
  };
}

function formatTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveLogFilePath(logFileArg) {
  if (logFileArg && logFileArg.trim()) {
    return path.resolve(process.cwd(), logFileArg.trim());
  }

  return path.resolve(
    __dirname,
    'logs',
    `led-bench-${formatTimestampForFile()}.jsonl`
  );
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJsonlRecord(logFile, record) {
  fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`, 'utf8');
}

function normalizeResponse(answer) {
  const normalized = String(answer || '').trim().toLowerCase();
  if (normalized === 'y' || normalized === 'yes') {
    return 'yes';
  }
  if (normalized === 'n' || normalized === 'no') {
    return 'no';
  }
  if (normalized === 's' || normalized === 'skip') {
    return 'skip';
  }
  if (normalized === 'q' || normalized === 'quit') {
    return 'quit';
  }
  return null;
}

function toHex(byte) {
  return `0x${Number(byte).toString(16).toUpperCase().padStart(2, '0')}`;
}

function summarizeMessage(message) {
  if (message.type === 'cc') {
    return `cc ch=${message.channel} ctrl=${message.controller} val=${message.value}`;
  }
  if (message.type === 'noteon' || message.type === 'noteoff') {
    return `${message.type} ch=${message.channel} note=${message.note} vel=${message.velocity}`;
  }
  if (message.type === 'sysex') {
    const hex = (message.bytes || []).map(toHex).join(' ');
    return `sysex [${hex}]`;
  }
  return `unknown ${JSON.stringify(message)}`;
}

function normalizeMessageForLog(message) {
  if (message.type === 'cc') {
    return {
      type: 'cc',
      channel: message.channel,
      controller: message.controller,
      value: message.value,
    };
  }
  if (message.type === 'noteon' || message.type === 'noteoff') {
    return {
      type: message.type,
      channel: message.channel,
      note: message.note,
      velocity: message.velocity,
    };
  }
  if (message.type === 'sysex') {
    return {
      type: 'sysex',
      bytes: message.bytes,
    };
  }

  return { type: 'unknown', raw: message };
}

function loadEasyMidi() {
  try {
    return require('easymidi');
  } catch (primaryError) {
    try {
      return require(path.resolve(__dirname, '../ui12-midi/node_modules/easymidi'));
    } catch (fallbackError) {
      const error = new Error(
        'Impossible de charger easymidi. Installe-le dans ui12-diode (npm i easymidi) ou garde le fallback ui12-midi disponible.'
      );
      error.cause = fallbackError || primaryError;
      throw error;
    }
  }
}

function resolvePortFromArgsOrAuto(outputs, forcedPort) {
  if (forcedPort) {
    if (!outputs.includes(forcedPort)) {
      throw new Error(
        [
          `Port MIDI OUT introuvable: "${forcedPort}"`,
          'Ports disponibles:',
          ...outputs.map((name, index) => `  [${index + 1}] ${name}`),
        ].join('\n')
      );
    }
    return forcedPort;
  }

  return outputs.find(name => {
    const lower = String(name).toLowerCase();
    return lower.includes('nanokontrol2') && lower.includes('ctrl');
  }) || null;
}

async function promptPortSelection(prompt, outputs) {
  if (outputs.length === 0) {
    throw new Error(
      'Aucun port MIDI OUT détecté. Branche nanoKONTROL2 et vérifie que le pilote expose un port de sortie.'
    );
  }

  console.log('\nPorts MIDI OUT disponibles:');
  outputs.forEach((name, index) => {
    console.log(`  [${index + 1}] ${name}`);
  });

  while (true) {
    const answer = await prompt('Choisis un index de port MIDI OUT: ');
    const parsed = Number(answer);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > outputs.length) {
      console.log('Index invalide. Réessaie.');
      continue;
    }

    return outputs[parsed - 1];
  }
}

async function sendMessage(output, message, dryRun) {
  if (dryRun) {
    return;
  }

  if (message.type === 'cc') {
    output.send('cc', {
      channel: message.channel,
      controller: message.controller,
      value: message.value,
    });
    return;
  }

  if (message.type === 'noteon' || message.type === 'noteoff') {
    output.send(message.type, {
      channel: message.channel,
      note: message.note,
      velocity: message.velocity,
    });
    return;
  }

  if (message.type === 'sysex') {
    output.send('sysex', message.bytes);
    return;
  }

  throw new Error(`Type de message MIDI inconnu: ${message.type}`);
}

async function askHackOutcome(prompt) {
  while (true) {
    const answer = await prompt(
      'Effet visible sur la diode Mute 1 ? [y]es / [n]o / [s]kip / [q]uit: '
    );
    const normalized = normalizeResponse(answer);

    if (normalized) {
      return normalized;
    }

    console.log('Réponse invalide. Utilise y, n, s ou q.');
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  const allHacks = getHackCatalog();
  if (options.startAt > allHacks.length) {
    throw new Error(`--start-at=${options.startAt} dépasse la taille du catalogue (${allHacks.length})`);
  }

  const startIndex = options.startAt - 1;
  const endIndex = options.max ? startIndex + options.max : allHacks.length;
  const hacks = allHacks.slice(startIndex, endIndex);
  if (hacks.length === 0) {
    throw new Error('Aucun hack à exécuter avec la combinaison --start-at / --max');
  }

  const sessionId = crypto.randomUUID();
  const logFile = resolveLogFilePath(options.logFile);
  ensureParentDir(logFile);

  const pipedAnswers = await readPipedAnswers();
  const rl = createReadline();
  const prompt = createPrompt(rl, pipedAnswers);
  let midiOutput = null;
  let selectedPort = null;

  let stopReason = 'completed';
  let successHackId = null;
  let successHackFamily = null;
  let counts = { yes: 0, no: 0, skip: 0, quit: 0 };

  try {
    console.log('=== nanoKONTROL2 LED bench (Mute 1) ===');
    console.log(`Session: ${sessionId}`);
    console.log(`Catalogue total: ${allHacks.length} hacks`);
    console.log(`Sélection: ${hacks.length} hacks (start-at=${options.startAt}${options.max ? `, max=${options.max}` : ''})`);
    console.log(`Log JSONL: ${logFile}`);
    console.log(`Mode: ${options.dryRun ? 'DRY-RUN (aucun envoi MIDI)' : 'LIVE MIDI'}`);

    if (!options.dryRun) {
      const easymidi = loadEasyMidi();
      const outputs = easymidi.getOutputs();

      selectedPort = resolvePortFromArgsOrAuto(outputs, options.port);
      if (!selectedPort) {
        selectedPort = await promptPortSelection(prompt, outputs);
      }

      console.log(`Port MIDI OUT sélectionné: ${selectedPort}`);
      midiOutput = new easymidi.Output(selectedPort);
    } else {
      console.log('Dry-run: pas de sélection de port MIDI requise.');
    }

    for (let i = 0; i < hacks.length; i += 1) {
      const hack = hacks[i];
      const globalIndex = startIndex + i + 1;
      const startedAt = Date.now();

      console.log('\n----------------------------------------');
      console.log(`[${i + 1}/${hacks.length}] #${globalIndex} ${hack.id}`);
      console.log(`Family: ${hack.family}`);
      console.log(`Title : ${hack.title}`);
      if (hack.notes) {
        console.log(`Notes : ${hack.notes}`);
      }

      for (let m = 0; m < hack.messages.length; m += 1) {
        const message = hack.messages[m];
        const waitAfterMs = Number.isInteger(message.waitAfterMs) ? message.waitAfterMs : 120;

        console.log(`  -> ${m + 1}/${hack.messages.length}: ${summarizeMessage(message)} (wait ${waitAfterMs}ms)`);
        await sendMessage(midiOutput, message, options.dryRun);
        await wait(waitAfterMs);
      }

      const response = await askHackOutcome(prompt);
      const elapsedMs = Date.now() - startedAt;

      const record = {
        timestamp: new Date().toISOString(),
        sessionId,
        hackId: hack.id,
        family: hack.family,
        messages: hack.messages.map(normalizeMessageForLog),
        response,
        notes: hack.notes || '',
        elapsedMs,
      };
      writeJsonlRecord(logFile, record);
      counts[response] += 1;

      if (response === 'yes') {
        stopReason = 'success';
        successHackId = hack.id;
        successHackFamily = hack.family;
        break;
      }
      if (response === 'quit') {
        stopReason = 'user_quit';
        break;
      }
    }
  } finally {
    if (midiOutput) {
      try {
        midiOutput.close();
      } catch (_) {
        // no-op
      }
    }
    rl.close();
  }

  console.log('\n=== Résumé ===');
  console.log(`Session : ${sessionId}`);
  if (selectedPort) {
    console.log(`Port    : ${selectedPort}`);
  }
  console.log(`Stop    : ${stopReason}`);
  if (successHackId) {
    console.log(`Succès  : ${successHackId} (${successHackFamily})`);
  }
  console.log(
    `Stats   : yes=${counts.yes} no=${counts.no} skip=${counts.skip} quit=${counts.quit}`
  );
  console.log(`Log     : ${logFile}`);
}

run().catch(error => {
  console.error(`Erreur: ${error.message}`);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HELP_TEXT = `
POC hack unique LED nanoKONTROL2 (Mute 1)

Usage:
  node led-hack-single.js [options]

Options:
  --port <name>      Force le port MIDI OUT exact
  --dry-run          N'envoie rien en MIDI (simulation)
  --log-file <path>  Chemin du fichier JSONL de sortie
  --help             Affiche cette aide
`.trim();

const NATIVE_IN_G0 = [0xF0, 0x42, 0x40, 0x00, 0x01, 0x13, 0x00, 0x00, 0x00, 0x01, 0xF7];
const LED_ON_VALUE = 127;
const LED_OFF_VALUE = 0;
const MUTE1_CONTROLLER = 48;
const MUTE1_CHANNEL = 15;

const tests = [
  {
    id: 'flash',
    stepName: 'Flash (200ms)',
    buildMessages() {
      return [
        { type: 'sysex', bytes: NATIVE_IN_G0, waitAfterMs: 200 },
        { type: 'cc', channel: MUTE1_CHANNEL, controller: MUTE1_CONTROLLER, value: LED_ON_VALUE, waitAfterMs: 200 },
        { type: 'cc', channel: MUTE1_CHANNEL, controller: MUTE1_CONTROLLER, value: LED_OFF_VALUE, waitAfterMs: 100 },
      ];
    },
    autoResetOff: false,
  },
  {
    id: 'on_definitif',
    stepName: 'Allumage maintenu',
    buildMessages() {
      return [
        { type: 'sysex', bytes: NATIVE_IN_G0, waitAfterMs: 200 },
        { type: 'cc', channel: MUTE1_CHANNEL, controller: MUTE1_CONTROLLER, value: LED_ON_VALUE, waitAfterMs: 120 },
      ];
    },
    autoResetOff: true,
  },
  {
    id: 'off',
    stepName: 'Extinction',
    buildMessages() {
      return [
        { type: 'sysex', bytes: NATIVE_IN_G0, waitAfterMs: 200 },
        { type: 'cc', channel: MUTE1_CHANNEL, controller: MUTE1_CONTROLLER, value: LED_OFF_VALUE, waitAfterMs: 120 },
      ];
    },
    autoResetOff: false,
  },
  {
    id: 'blink_10_cycles',
    stepName: 'Blink 10 cycles (0.4s ON / 0.2s OFF)',
    buildMessages() {
      const messages = [{ type: 'sysex', bytes: NATIVE_IN_G0, waitAfterMs: 200 }];
      for (let i = 0; i < 10; i += 1) {
        messages.push({
          type: 'cc',
          channel: MUTE1_CHANNEL,
          controller: MUTE1_CONTROLLER,
          value: LED_ON_VALUE,
          waitAfterMs: 400,
        });
        messages.push({
          type: 'cc',
          channel: MUTE1_CHANNEL,
          controller: MUTE1_CONTROLLER,
          value: LED_OFF_VALUE,
          waitAfterMs: 200,
        });
      }
      return messages;
    },
    autoResetOff: false,
  },
];

function parseArgs(argv) {
  const options = {
    port: null,
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

  return path.resolve(__dirname, 'logs', `led-hack-single-${formatTimestampForFile()}.jsonl`);
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
  if (message.type === 'sysex') {
    return `sysex [${message.bytes.map(toHex).join(' ')}]`;
  }
  return `unknown ${JSON.stringify(message)}`;
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
  if (message.type === 'sysex') {
    output.send('sysex', message.bytes);
    return;
  }

  throw new Error(`Type de message MIDI inconnu: ${message.type}`);
}

async function askTestOutcome(prompt) {
  while (true) {
    const answer = await prompt('Effet visible ? [y]es / [n]o / [s]kip / [q]uit: ');
    const normalized = normalizeResponse(answer);
    if (normalized) {
      return normalized;
    }
    console.log('Réponse invalide. Utilise y, n, s ou q.');
  }
}

function normalizeMessageForLog(message) {
  if (message.type === 'cc') {
    return {
      type: 'cc',
      channel: message.channel,
      controller: message.controller,
      value: message.value,
      waitAfterMs: message.waitAfterMs,
    };
  }
  if (message.type === 'sysex') {
    return {
      type: 'sysex',
      bytes: message.bytes,
      waitAfterMs: message.waitAfterMs,
    };
  }

  return { type: 'unknown', raw: message };
}

async function forceLedOff(output, dryRun) {
  await sendMessage(
    output,
    {
      type: 'cc',
      channel: MUTE1_CHANNEL,
      controller: MUTE1_CONTROLLER,
      value: LED_OFF_VALUE,
      waitAfterMs: 0,
    },
    dryRun
  );
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  const sessionId = crypto.randomUUID();
  const logFile = resolveLogFilePath(options.logFile);
  ensureParentDir(logFile);

  const pipedAnswers = await readPipedAnswers();
  const rl = createReadline();
  const prompt = createPrompt(rl, pipedAnswers);

  let selectedPort = null;
  let midiOutput = null;
  const counts = { yes: 0, no: 0, skip: 0, quit: 0 };
  let stopReason = 'completed';

  try {
    console.log('=== nanoKONTROL2 LED hack single (pf-native-inreq-g0) ===');
    console.log(`Session: ${sessionId}`);
    console.log(`Tests  : ${tests.length}`);
    console.log(`Log    : ${logFile}`);
    console.log(`Mode   : ${options.dryRun ? 'DRY-RUN (aucun envoi MIDI)' : 'LIVE MIDI'}`);

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

    for (let i = 0; i < tests.length; i += 1) {
      const test = tests[i];
      const messages = test.buildMessages();
      const startedAt = Date.now();

      console.log('\n----------------------------------------');
      console.log(`[${i + 1}/${tests.length}] ${test.id} - ${test.stepName}`);

      for (let m = 0; m < messages.length; m += 1) {
        const message = messages[m];
        const waitAfterMs = Number.isInteger(message.waitAfterMs) ? message.waitAfterMs : 0;

        console.log(`  -> ${m + 1}/${messages.length}: ${summarizeMessage(message)} (wait ${waitAfterMs}ms)`);
        await sendMessage(midiOutput, message, options.dryRun);
        if (waitAfterMs > 0) {
          await wait(waitAfterMs);
        }
      }

      const response = await askTestOutcome(prompt);
      counts[response] += 1;

      const elapsedMs = Date.now() - startedAt;
      writeJsonlRecord(logFile, {
        timestamp: new Date().toISOString(),
        sessionId,
        testId: test.id,
        stepName: test.stepName,
        messages: messages.map(normalizeMessageForLog),
        response,
        elapsedMs,
        port: selectedPort,
        dryRun: options.dryRun,
      });

      if (response === 'quit') {
        stopReason = 'user_quit';
        break;
      }

      if (test.autoResetOff) {
        await forceLedOff(midiOutput, options.dryRun);
        await wait(100);
      }
    }

    await forceLedOff(midiOutput, options.dryRun);
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
  console.log(`Stats   : yes=${counts.yes} no=${counts.no} skip=${counts.skip} quit=${counts.quit}`);
  console.log(`Log     : ${logFile}`);
}

run().catch(error => {
  console.error(`Erreur: ${error.message}`);
  process.exit(1);
});

function parseSectionName(sectionRaw) {
  const section = sectionRaw.trim();

  if (section.toLowerCase() === 'meta') {
    return { type: 'meta' };
  }

  const bankMatch = /^bank:(\d+)$/i.exec(section);
  if (bankMatch) {
    const bankIndex = Number(bankMatch[1]);
    if (bankIndex >= 1) {
      return { type: 'bank', bankIndex };
    }
  }

  return { type: 'unknown' };
}

function parseMapText(content, sourceName = '<inline>') {
  const warnings = [];
  const meta = {};
  const banks = new Map();

  let currentSection = null;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    const sectionMatch = /^\[(.+)]$/.exec(line);
    if (sectionMatch) {
      currentSection = parseSectionName(sectionMatch[1]);
      if (currentSection.type === 'unknown') {
        warnings.push(`${sourceName}:${lineNumber} section inconnue ignorée: [${sectionMatch[1]}]`);
      }
      if (currentSection.type === 'bank' && !banks.has(currentSection.bankIndex)) {
        banks.set(currentSection.bankIndex, {});
      }
      continue;
    }

    const entryMatch = /^([^=]+)=(.*)$/.exec(rawLine);
    if (!entryMatch) {
      warnings.push(`${sourceName}:${lineNumber} ligne invalide ignorée: ${line}`);
      continue;
    }

    if (!currentSection || currentSection.type === 'unknown') {
      warnings.push(`${sourceName}:${lineNumber} affectation hors section ignorée: ${line}`);
      continue;
    }

    const key = entryMatch[1].trim();
    const value = entryMatch[2].trim();

    if (currentSection.type === 'meta') {
      if (key) {
        meta[key] = value;
      }
      continue;
    }

    const stripMatch = /^f([1-8])$/i.exec(key);
    if (!stripMatch) {
      warnings.push(`${sourceName}:${lineNumber} strip invalide ignoré: ${key}`);
      continue;
    }

    if (!value) {
      warnings.push(`${sourceName}:${lineNumber} alias vide ignoré pour ${key}`);
      continue;
    }

    const stripIndex = Number(stripMatch[1]);
    banks.get(currentSection.bankIndex)[stripIndex] = value;
  }

  for (const [bankIndex, strips] of banks.entries()) {
    if (Object.keys(strips).length === 0) {
      warnings.push(`${sourceName} bank:${bankIndex} ignorée (aucune affectation valide)`);
      banks.delete(bankIndex);
    }
  }

  return {
    meta,
    banks,
    warnings,
  };
}

module.exports = {
  parseMapText,
};

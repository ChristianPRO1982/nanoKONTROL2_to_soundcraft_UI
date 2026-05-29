function normalizeLine(line) {
  const normalized = String(line || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('3:::')) {
    return normalized.slice(4);
  }

  return normalized;
}

function parseSetdLine(line) {
  const normalized = normalizeLine(line);
  if (!normalized || !normalized.startsWith('SETD^')) {
    return null;
  }

  const parts = normalized.split('^');
  if (parts.length < 3) {
    return null;
  }

  const path = String(parts[1] || '').trim();
  const valueRaw = String(parts[2] || '').trim();
  if (!path || !valueRaw) {
    return null;
  }

  const value = Number(valueRaw);
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    type: 'set',
    path,
    value,
  };
}

function parseUi12Message(payload) {
  const text = String(payload || '');
  if (!text) {
    return [];
  }

  const events = [];
  text.split(/\r?\n/).forEach(line => {
    const parsed = parseSetdLine(line);
    if (parsed) {
      events.push(parsed);
    }
  });

  return events;
}

module.exports = {
  parseSetdLine,
  parseUi12Message,
};

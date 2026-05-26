function normalizeAlias(alias) {
  return alias.trim().toLowerCase();
}

function buildResolvedBanks(parsedMap, aliasesContract) {
  const warnings = [...parsedMap.warnings];
  const aliasRegistry = aliasesContract.aliases;

  const bankList = [...parsedMap.banks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bankIndex, strips]) => {
      const resolvedStrips = new Map();

      Object.entries(strips).forEach(([stripText, rawAlias]) => {
        const strip = Number(stripText);
        const alias = normalizeAlias(rawAlias);
        const aliasDefinition = aliasRegistry[alias];

        if (!aliasDefinition) {
          warnings.push(`bank:${bankIndex} f${strip} alias inconnu ignoré: ${alias}`);
          return;
        }

        resolvedStrips.set(strip, {
          alias,
          channels: [...aliasDefinition.channels],
          capabilities: new Set(aliasDefinition.capabilities),
        });
      });

      if (resolvedStrips.size === 0) {
        warnings.push(`bank:${bankIndex} ignorée (aucun alias valide)`);
        return null;
      }

      return {
        bankIndex,
        strips: resolvedStrips,
      };
    })
    .filter(Boolean);

  return {
    meta: parsedMap.meta,
    banks: bankList,
    warnings,
  };
}

function getCapabilityForControl(controlType) {
  if (controlType === 'fader') {
    return 'mix';
  }
  if (controlType === 'knob') {
    return 'gain';
  }
  if (controlType === 'solo') {
    return 'solo';
  }
  if (controlType === 'mute') {
    return 'mute';
  }
  return null;
}

module.exports = {
  buildResolvedBanks,
  getCapabilityForControl,
};

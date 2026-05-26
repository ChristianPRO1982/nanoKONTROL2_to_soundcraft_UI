function invertStripMapping(mappingObj) {
  const result = new Map();

  Object.entries(mappingObj).forEach(([stripText, cc]) => {
    const strip = Number(stripText);
    result.set(Number(cc), strip);
  });

  return result;
}

function mapTransportByCc(transportMapping) {
  const result = new Map();

  Object.entries(transportMapping).forEach(([action, cc]) => {
    result.set(Number(cc), action);
  });

  return result;
}

function buildControllerLayout(controllerContract) {
  const controllers = controllerContract.controllers;

  return {
    faderByCc: invertStripMapping(controllers.faders.mapping),
    knobByCc: invertStripMapping(controllers.knobs.mapping),
    soloByCc: invertStripMapping(controllers.soloButtons.mapping),
    muteByCc: invertStripMapping(controllers.muteButtons.mapping),
    transportByCc: mapTransportByCc(controllers.transport),
    bankNavigation: {
      leftCc: Number(controllers.bankNavigation.markerLeft),
      rightCc: Number(controllers.bankNavigation.markerRight),
    },
    togglePressedValue: Number(controllers.soloButtons.pressedValue),
  };
}

module.exports = {
  buildControllerLayout,
};

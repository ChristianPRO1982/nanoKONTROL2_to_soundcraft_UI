const easymidi = require('easymidi');

const input = new easymidi.Input(
  'nanoKONTROL2:nanoKONTROL2 nanoKONTROL2 _ CTR 20:0'
);

input.on('cc', msg => {
  console.log(`controller=${msg.controller} value=${msg.value}`);
});


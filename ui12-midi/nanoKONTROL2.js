const { bootstrap } = require('./runtime/app');

bootstrap().catch(error => {
  console.error(`Erreur fatale: ${error.message}`);
  process.exit(1);
});

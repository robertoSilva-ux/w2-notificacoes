/**
 * Entrada da aplicação (composition root).
 *
 * A versão original, em um único arquivo, está preservada em `legacy/index.ts` —
 * ela é a referência do contrato e a base das comparações feitas no README.
 */
import { loadConfig } from './main/config.js';
import { startServer } from './main/server.js';

startServer(loadConfig()).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

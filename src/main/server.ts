import type { Server } from 'node:http';
import { createApp } from '../adapters/in/http/app.js';
import type { AppConfig } from './config.js';
import { buildContainer, type Container } from './container.js';

export interface RunningApp {
  server: Server;
  container: Container;
}

/** Sobe a API: compõe as dependências e liga o adaptador HTTP na porta configurada. */
export async function startServer(config: AppConfig): Promise<RunningApp> {
  const container = buildContainer(config);
  const app = createApp(container.uses);

  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(config.port, () => resolve(listening));
    listening.on('error', reject);
  });

  console.log(`Aula 07 - notificações rodando em http://localhost:${config.port}`);
  return { server, container };
}

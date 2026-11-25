// Sobe a aplicação SEM banco: só os repositórios em memória (Etapa 9, item 4).
import { startApi, type Api } from './api.ts';

export type { Api } from './api.ts';

export function startMemoryApi({ port, extraEnv = {} }: { port: number; extraEnv?: Record<string, string> }): Promise<Api> {
  return startApi({ port, db: 'unused-memory.db', storage: 'memory', extraEnv });
}

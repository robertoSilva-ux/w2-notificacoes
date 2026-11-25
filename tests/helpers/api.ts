// Sobe a versão ORIGINAL do serviço (src/index.ts, intocado) em um processo separado,
// para que os testes falem com ela só por HTTP — caixa-preta de verdade.
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = process.cwd();
const TSX = join(repoRoot, 'node_modules/.bin/tsx');

export interface Api {
  base: string;
  close(): Promise<void>;
}

export interface ApiOptions {
  port: number;
  db: string;
  /** 0 = provedor de SMS nunca falha; 1 = sempre falha */
  smsFailureRate?: number;
  /** 'memory' sobe a aplicação sem tocar em banco (Etapa 9) */
  storage?: 'prisma' | 'memory';
  extraEnv?: Record<string, string>;
}

export async function startApi({
  port,
  db,
  smsFailureRate = 0,
  storage = 'prisma',
  extraEnv = {},
}: ApiOptions): Promise<Api> {
  const child: ChildProcess = spawn(TSX, ['src/index.ts'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `file:./${db}`,
      SMS_FAILURE_RATE: String(smsFailureRate),
      APP_STORAGE: storage,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let log = '';
  child.stdout?.on('data', (d) => (log += d.toString()));
  child.stderr?.on('data', (d) => (log += d.toString()));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`servidor saiu antes de ficar pronto:\n${log}`);
    try {
      const res = await fetch(`${base}/contacts`);
      if (res.ok) return { base, close: () => stop(child) };
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  child.kill('SIGKILL');
  throw new Error(`timeout esperando o servidor:\n${log}`);
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    const t = setTimeout(() => child.kill('SIGKILL'), 3000);
    t.unref?.();
  });
}

export interface Res {
  status: number;
  contentType: string;
  text: string;
  json: any;
}

export async function req(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Res> {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* resposta não-JSON */
  }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, json };
}

export const contact = (base: string, data: Record<string, unknown>) =>
  req(base, 'POST', '/contacts', data);

export const notify = (base: string, data: Record<string, unknown>) =>
  req(base, 'POST', '/notifications', data);

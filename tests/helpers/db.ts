// Cria um banco SQLite novo aplicando os SQL de prisma/migrations (sem o CLI do Prisma).
// Usado pelos testes: cada arquivo de teste ganha um banco próprio e descartável.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const require = createRequire(join(repoRoot, 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

export function removeDb(file: string): void {
  const path = join(repoRoot, file);
  for (const f of [path, `${path}-journal`, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(f)) rmSync(f);
  }
}

export function freshDb(file: string): string {
  removeDb(file);
  const path = join(repoRoot, file);
  const db = new Database(path);
  const dir = join(repoRoot, 'prisma/migrations');
  const migrations = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const m of migrations) {
    db.exec(readFileSync(join(dir, m, 'migration.sql'), 'utf8'));
  }
  db.close();
  return file;
}

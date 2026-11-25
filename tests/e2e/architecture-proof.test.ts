// Etapa 9 — provas da arquitetura: canal novo e boot sem Prisma, ambos exercitados por HTTP.
// Se este arquivo passa, a extensão funciona; e o `git diff` mostra que domínio e casos de uso
// não precisaram mudar para isso.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { contact, notify, req } from '../helpers/api.ts';
import { startMemoryApi, type Api } from '../helpers/memory-api.ts';

let api: Api;

before(async () => {
  // sobe SEM banco: apenas repositórios em memória (APP_STORAGE=memory, sem DATABASE_URL)
  api = await startMemoryApi({ port: 3041 });
});

after(async () => {
  await api?.close();
});

test('a aplicação sobe sem Postgres/SQLite: só repositórios em memória', async () => {
  const res = await req(api.base, 'GET', '/contacts');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, []);
});

test('canal novo (whatsapp) entra sem tocar no domínio nem nos casos de uso', async () => {
  const c = await contact(api.base, { name: 'Ana', email: 'ana@ifrs.edu.br', phone: '+5511999998888' });
  const res = await notify(api.base, { contactId: c.json.id, channels: ['whatsapp'], message: 'Oi pelo zap' });

  assert.equal(res.status, 201);
  assert.equal(res.json[0].channel, 'whatsapp');
  assert.equal(res.json[0].status, 'SENT');
  assert.equal(res.json[0].attempts, 1);
  assert.match(res.json[0].providerId, /^whatsapp-/);
});

test('as regras do canal novo vêm da descrição dele no domínio', async () => {
  const soEmail = await contact(api.base, { name: 'Beto', email: 'beto@ifrs.edu.br' });
  const semTelefone = await notify(api.base, { contactId: soEmail.json.id, channels: ['whatsapp'], message: 'Oi' });
  assert.equal(semTelefone.status, 201);
  assert.equal(semTelefone.json[0].status, 'FAILED');
  assert.match(semTelefone.json[0].lastError, /telefone/);

  const comTelefone = await contact(api.base, { name: 'Caio', phone: '+5511988887777' });
  const longo = await notify(api.base, { contactId: comTelefone.json.id, channels: ['whatsapp'], message: 'a'.repeat(4097) });
  assert.equal(longo.json[0].status, 'FAILED');
  assert.match(longo.json[0].lastError, /4096/);
});

test('o canal novo é aceito no optOut do contato', async () => {
  const c = await contact(api.base, { name: 'Dora', phone: '+5511977776666', optOut: ['whatsapp'] });
  assert.equal(c.status, 201);
  assert.deepEqual(c.json.optOut, ['whatsapp']);

  const res = await notify(api.base, { contactId: c.json.id, channels: ['whatsapp'], message: 'Oi' });
  assert.equal(res.json[0].status, 'FAILED');
  assert.match(res.json[0].lastError, /optou por não receber whatsapp/);
});

// Etapa 1 — contrato de /contacts, exercitado por HTTP contra a versão original.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDb, removeDb } from '../helpers/db.ts';
import { contact, req, startApi, type Api } from '../helpers/api.ts';

const DB = 'test-contacts.db';
const PORT = 3031;
let api: Api;

before(async () => {
  freshDb(DB);
  api = await startApi({ port: PORT, db: DB });
});

after(async () => {
  await api?.close();
  removeDb(DB);
});

test('POST /contacts cria contato e devolve 201 com optOut como array', async () => {
  const res = await contact(api.base, { name: '  Ana  ', email: 'ana@ifrs.edu.br', phone: '+5551999998888' });
  assert.equal(res.status, 201);
  assert.deepEqual(Object.keys(res.json).sort(), ['createdAt', 'email', 'id', 'name', 'optOut', 'phone']);
  assert.equal(res.json.name, 'Ana', 'nome é gravado com trim');
  assert.deepEqual(res.json.optOut, []);
  assert.equal(res.json.email, 'ana@ifrs.edu.br');
});

test('POST /contacts com optOut devolve a lista de canais', async () => {
  const res = await contact(api.base, { name: 'Beto', email: 'beto@ifrs.edu.br', optOut: ['sms', 'email'] });
  assert.equal(res.status, 201);
  assert.deepEqual(res.json.optOut, ['sms', 'email']);
});

test('POST /contacts rejeita name com menos de 2 caracteres', async () => {
  const res = await contact(api.base, { name: 'A', email: 'a@b.com' });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /name/i);
});

test('POST /contacts rejeita contato sem email e sem phone', async () => {
  const res = await contact(api.base, { name: 'Sem Contato' });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /email ou phone/i);
});

test('POST /contacts rejeita email inválido', async () => {
  const res = await contact(api.base, { name: 'Beto', email: 'beto@' });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /email/i);
});

test('POST /contacts rejeita phone fora do E.164', async () => {
  const res = await contact(api.base, { name: 'Caio', phone: '5551999998888' });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /E\.164|phone/i);
});

test('POST /contacts rejeita optOut com canal desconhecido', async () => {
  const res = await contact(api.base, { name: 'Dora', email: 'dora@ifrs.edu.br', optOut: ['pombo'] });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /optOut|fake, sms, email/i);
});

test('GET /contacts lista em ordem crescente de id', async () => {
  const res = await req(api.base, 'GET', '/contacts');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json));
  const ids = res.json.map((c: any) => c.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.ok(res.json.every((c: any) => Array.isArray(c.optOut)));
});

test('GET /contacts/:id devolve o contato e 404 quando não existe', async () => {
  const criado = await contact(api.base, { name: 'Eva', email: 'eva@ifrs.edu.br' });
  const ok = await req(api.base, 'GET', `/contacts/${criado.json.id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.id, criado.json.id);

  const faltando = await req(api.base, 'GET', '/contacts/999999');
  assert.equal(faltando.status, 404);
  assert.match(faltando.json.error, /contato/i);
});

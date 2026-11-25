// Etapa 1 — contrato de POST /notifications/:id/retry.
// Usa dois processos sobre o MESMO arquivo de banco: um com o provedor de SMS sempre falhando
// (SMS_FAILURE_RATE=1) para produzir a notificação FAILED, outro com o provedor sempre OK para
// provar o caminho de sucesso do reenvio.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDb, removeDb } from '../helpers/db.ts';
import { contact, notify, req, startApi, type Api } from '../helpers/api.ts';

const DB = 'test-retry.db';
const PORT = 3033;
const MSG = 'Sua matrícula foi confirmada';
let api: Api;

before(async () => {
  freshDb(DB);
  api = await startApi({ port: PORT, db: DB, smsFailureRate: 1 });
});

after(async () => {
  await api?.close();
  removeDb(DB);
});

test('retry de notificação já enviada devolve 409', async () => {
  const c = await contact(api.base, { name: 'Ana', email: 'ana@ifrs.edu.br' });
  const criada = await notify(api.base, { contactId: c.json.id, channels: ['fake'], message: MSG });
  assert.equal(criada.json[0].status, 'SENT');

  const res = await req(api.base, 'POST', `/notifications/${criada.json[0].id}/retry`);
  assert.equal(res.status, 409);
  assert.match(res.json.error, /já foi enviada/i);
});

test('retry de notificação inexistente devolve 404', async () => {
  const res = await req(api.base, 'POST', '/notifications/999999/retry');
  assert.equal(res.status, 404);
  assert.match(res.json.error, /notifica/i);
});

test('retry de notificação barrada por regra de canal devolve 422', async () => {
  const c = await contact(api.base, { name: 'Beto', email: 'beto@ifrs.edu.br' });
  const criada = await notify(api.base, { contactId: c.json.id, channels: ['sms'], message: MSG });
  assert.equal(criada.json[0].status, 'FAILED');

  const res = await req(api.base, 'POST', `/notifications/${criada.json[0].id}/retry`);
  assert.equal(res.status, 422);
  assert.match(res.json.error, /telefone/i);
});

test('retry com provedor indisponível devolve 502 e incrementa attempts', async () => {
  const c = await contact(api.base, { name: 'Caio', email: 'caio@ifrs.edu.br', phone: '+5551988887777' });
  const criada = await notify(api.base, { contactId: c.json.id, channels: ['sms'], message: MSG });
  assert.equal(criada.status, 201);
  assert.equal(criada.json[0].status, 'FAILED');
  assert.equal(criada.json[0].attempts, 1);
  assert.match(criada.json[0].lastError, /operadora/i);

  const id = criada.json[0].id;
  const r1 = await req(api.base, 'POST', `/notifications/${id}/retry`);
  assert.equal(r1.status, 502);
  assert.equal(r1.json.status, 'FAILED');
  assert.equal(r1.json.attempts, 2);
  assert.match(r1.json.lastError, /operadora/i);

  const r2 = await req(api.base, 'POST', `/notifications/${id}/retry`);
  assert.equal(r2.status, 502);
  assert.equal(r2.json.attempts, 3);

  const r3 = await req(api.base, 'POST', `/notifications/${id}/retry`);
  assert.equal(r3.status, 409, 'limite de 3 tentativas');
  assert.match(r3.json.error, /tentativas/i);
});

test('retry bem-sucedido quando o provedor volta a responder', async () => {
  const c = await contact(api.base, { name: 'Dora', email: 'dora@ifrs.edu.br', phone: '+5551977776666' });
  const criada = await notify(api.base, { contactId: c.json.id, channels: ['sms'], message: MSG });
  assert.equal(criada.json[0].status, 'FAILED');

  // troca o processo por um com o provedor saudável (mesmo banco)
  await api.close();
  api = await startApi({ port: PORT, db: DB, smsFailureRate: 0 });

  const res = await req(api.base, 'POST', `/notifications/${criada.json[0].id}/retry`);
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'SENT');
  assert.equal(res.json.attempts, 2);
  assert.equal(res.json.lastError, null);
  assert.match(res.json.providerId, /^sms-/);
  assert.ok(res.json.sentAt);
});

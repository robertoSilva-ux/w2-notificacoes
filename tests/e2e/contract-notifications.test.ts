// Etapa 1 — contrato de /notifications e /fake-inbox contra a versão original.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDb, removeDb } from '../helpers/db.ts';
import { contact, notify, req, startApi, type Api } from '../helpers/api.ts';

const DB = 'test-notifications.db';
const PORT = 3032;
const MSG = 'Sua matrícula foi confirmada';
let api: Api;

before(async () => {
  freshDb(DB);
  api = await startApi({ port: PORT, db: DB, smsFailureRate: 0 });
});

after(async () => {
  await api?.close();
  removeDb(DB);
});

test('POST /notifications envia pelos três canais e devolve 201 com array', async () => {
  const c = await contact(api.base, { name: 'Ana', email: 'ana@ifrs.edu.br', phone: '+5551999998888' });
  const res = await notify(api.base, { contactId: c.json.id, channels: ['fake', 'sms', 'email'], subject: 'Matrícula', message: MSG });

  assert.equal(res.status, 201);
  assert.ok(Array.isArray(res.json));
  assert.deepEqual(res.json.map((n: any) => n.channel), ['fake', 'sms', 'email']);
  for (const n of res.json) {
    assert.equal(n.status, 'SENT');
    assert.equal(n.attempts, 1);
    assert.equal(n.contactId, c.json.id);
    assert.equal(n.message, MSG);
    assert.ok(n.providerId, 'providerId preenchido');
    assert.ok(n.sentAt, 'sentAt preenchido');
    assert.equal(n.lastError, null);
  }
  assert.match(res.json[0].providerId, /^fake-/);
  assert.match(res.json[1].providerId, /^sms-/);
  assert.match(res.json[2].providerId, /<[^>]+@notificacoes\.local>$/);
});

test('POST /notifications exige contactId, channels não vazio e message', async () => {
  const semCampos = await notify(api.base, {});
  assert.equal(semCampos.status, 400);
  assert.match(semCampos.json.error, /obrigat/i);

  const canaisVazios = await notify(api.base, { contactId: 1, channels: [], message: MSG });
  assert.equal(canaisVazios.status, 400);
});

test('POST /notifications rejeita canal desconhecido', async () => {
  const c = await contact(api.base, { name: 'Beto', email: 'beto@ifrs.edu.br' });
  const res = await notify(api.base, { contactId: c.json.id, channels: ['pombo'], message: MSG });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /pombo/);
});

test('POST /notifications devolve 404 para contato inexistente', async () => {
  const res = await notify(api.base, { contactId: 999999, channels: ['fake'], message: MSG });
  assert.equal(res.status, 404);
  assert.match(res.json.error, /contato/i);
});

test('notificação barrada por regra de canal nasce FAILED e a resposta é 201', async () => {
  // um contato por regra, para não esbarrar no limite de 5/min
  const optOut = await contact(api.base, { name: 'Caio', email: 'caio@ifrs.edu.br', phone: '+5551988887777', optOut: ['sms'] });
  const r1 = await notify(api.base, { contactId: optOut.json.id, channels: ['sms'], message: MSG });
  assert.equal(r1.status, 201);
  assert.equal(r1.json[0].status, 'FAILED');
  assert.match(r1.json[0].lastError, /optou/i);
  assert.equal(r1.json[0].providerId, null);

  const semTelefone = await contact(api.base, { name: 'Dora', email: 'dora@ifrs.edu.br' });
  const r2 = await notify(api.base, { contactId: semTelefone.json.id, channels: ['sms'], message: MSG });
  assert.equal(r2.json[0].status, 'FAILED');
  assert.match(r2.json[0].lastError, /telefone/i);

  const semAssunto = await contact(api.base, { name: 'Eva', email: 'eva@ifrs.edu.br' });
  const r3 = await notify(api.base, { contactId: semAssunto.json.id, channels: ['email'], message: MSG });
  assert.equal(r3.json[0].status, 'FAILED');
  assert.match(r3.json[0].lastError, /subject/i);

  const smsLongo = await contact(api.base, { name: 'Fabio', phone: '+5551977776666' });
  const r4 = await notify(api.base, { contactId: smsLongo.json.id, channels: ['sms'], message: 'a'.repeat(161) });
  assert.equal(r4.json[0].status, 'FAILED');
  assert.match(r4.json[0].lastError, /160/);

  const smsNoLimite = await contact(api.base, { name: 'Gil', phone: '+5551966665555' });
  const r5 = await notify(api.base, { contactId: smsNoLimite.json.id, channels: ['sms'], message: 'a'.repeat(160) });
  assert.equal(r5.json[0].status, 'SENT', '160 caracteres ainda é permitido');
});

test('canais repetidos no mesmo pedido são deduplicados', async () => {
  const c = await contact(api.base, { name: 'Helo', email: 'helo@ifrs.edu.br' });
  const res = await notify(api.base, { contactId: c.json.id, channels: ['fake', 'fake'], message: MSG });
  assert.equal(res.status, 201);
  assert.equal(res.json.length, 1);
});

test('POST /notifications aplica o limite de 5 por minuto por contato', async () => {
  const c = await contact(api.base, { name: 'Ivo', email: 'ivo@ifrs.edu.br' });
  for (let i = 0; i < 5; i++) {
    const ok = await notify(api.base, { contactId: c.json.id, channels: ['fake'], message: MSG });
    assert.equal(ok.status, 201, `envio ${i + 1} deveria passar`);
  }
  const excedente = await notify(api.base, { contactId: c.json.id, channels: ['fake'], message: MSG });
  assert.equal(excedente.status, 429);
  assert.match(excedente.json.error, /limite/i);
});

test('GET /notifications filtra por status (sem diferenciar maiúsculas), canal e contato', async () => {
  const c = await contact(api.base, { name: 'Joana', email: 'joana@ifrs.edu.br', optOut: ['sms'] });
  await notify(api.base, { contactId: c.json.id, channels: ['fake'], message: MSG });
  await notify(api.base, { contactId: c.json.id, channels: ['sms'], message: MSG });

  const falhas = await req(api.base, 'GET', `/notifications?status=failed&contactId=${c.json.id}`);
  assert.equal(falhas.status, 200);
  assert.equal(falhas.json.length, 1);
  assert.equal(falhas.json[0].status, 'FAILED');

  const porCanal = await req(api.base, 'GET', `/notifications?channel=fake&contactId=${c.json.id}`);
  assert.equal(porCanal.json.length, 1);
  assert.equal(porCanal.json[0].channel, 'fake');

  const todos = await req(api.base, 'GET', '/notifications');
  const ids = todos.json.map((n: any) => n.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a), 'lista vem em ordem decrescente de id');
});

test('GET /notifications/:id embute o contato (optOut em string) e 404 quando não existe', async () => {
  const c = await contact(api.base, { name: 'Kleber', email: 'kleber@ifrs.edu.br', optOut: ['email'] });
  const criada = await notify(api.base, { contactId: c.json.id, channels: ['fake'], message: MSG });

  const det = await req(api.base, 'GET', `/notifications/${criada.json[0].id}`);
  assert.equal(det.status, 200);
  assert.equal(det.json.id, criada.json[0].id);
  assert.equal(det.json.contact.id, c.json.id);
  assert.equal(det.json.contact.optOut, 'email', 'contrato atual: string CSV no contato embutido');

  const naoExiste = await req(api.base, 'GET', '/notifications/999999');
  assert.equal(naoExiste.status, 404);
  assert.match(naoExiste.json.error, /notifica/i);
});

test('GET /fake-inbox/:contactId devolve o que o canal fake entregou', async () => {
  const c = await contact(api.base, { name: 'Lia', email: 'lia@ifrs.edu.br' });
  const enviada = await notify(api.base, { contactId: c.json.id, channels: ['fake'], subject: 'Oi', message: MSG });

  const inbox = await req(api.base, 'GET', `/fake-inbox/${c.json.id}`);
  assert.equal(inbox.status, 200);
  assert.equal(inbox.json.length, 1);
  assert.equal(inbox.json[0].id, enviada.json[0].providerId);
  assert.equal(inbox.json[0].contactId, c.json.id);
  assert.equal(inbox.json[0].subject, 'Oi');
  assert.equal(inbox.json[0].message, MSG);
  assert.ok(inbox.json[0].receivedAt);
});

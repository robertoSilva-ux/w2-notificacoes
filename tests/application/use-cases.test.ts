// Casos de uso com portas em memória e dublês — sem HTTP, sem banco, sem tempo real.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ContactNotFound,
  DeliveryFailed,
  NotificationNotFound,
  AlreadySent,
  ChannelRejected,
  RateLimited,
  RetryLimitReached,
  UnknownChannel,
} from '../../src/domain/errors.js';
import { buildCore } from './harness.js';

const MSG = 'Sua matrícula foi confirmada';

async function comContato(core = buildCore()) {
  const contact = await core.createContact.execute({ name: 'Ana', email: 'ana@ifrs.edu.br', phone: '+5511999998888' });
  return { core, contact };
}

test('envia pelos três canais e registra SENT com attempts 1', async () => {
  const { core, contact } = await comContato();
  const result = await core.send.execute({ contactId: contact.id!, channels: ['fake', 'sms', 'email'], subject: 'Matrícula', message: MSG });

  assert.deepEqual(result.map((n) => n.channel.name), ['fake', 'sms', 'email']);
  for (const n of result) {
    assert.equal(n.status, 'SENT');
    assert.equal(n.attempts, 1);
    assert.equal(n.sentAt?.toISOString(), core.clock.now().toISOString());
  }
  assert.match(result[0].providerId!, /^fake-id-/);
  assert.equal(core.smsSender.sent.length, 1);
  assert.equal(core.emailSender.sent[0].subject, 'Matrícula');
});

test('conflito de canal não entrega e nasce FAILED com attempts 0', async () => {
  const core = buildCore();
  const contact = await core.createContact.execute({ name: 'Beto', email: 'beto@ifrs.edu.br', phone: '+5511999998888', optOut: ['sms'] });
  const [sms] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: MSG });

  assert.equal(sms.status, 'FAILED');
  assert.equal(sms.attempts, 0);
  assert.match(sms.lastError!, /optou por não receber sms/);
  assert.equal(core.smsSender.sent.length, 0);
});

test('limite de SMS (160) e subject obrigatório são regras do domínio', async () => {
  const core = buildCore();
  const soEmail = await core.createContact.execute({ name: 'Caio', email: 'caio@ifrs.edu.br' });
  const soTelefone = await core.createContact.execute({ name: 'Dora', phone: '+5511999998888' });

  const [smsLongo] = await core.send.execute({ contactId: soTelefone.id!, channels: ['sms'], message: 'a'.repeat(161) });
  assert.match(smsLongo.lastError!, /160/);

  const [smsNoLimite] = await core.send.execute({ contactId: soTelefone.id!, channels: ['sms'], message: 'a'.repeat(160) });
  assert.equal(smsNoLimite.status, 'SENT');

  const [semAssunto] = await core.send.execute({ contactId: soEmail.id!, channels: ['email'], message: MSG });
  assert.match(semAssunto.lastError!, /exige subject/);
});

test('canal desconhecido é rejeitado antes de olhar o contato', async () => {
  const core = buildCore();
  await assert.rejects(
    () => core.send.execute({ contactId: 999, channels: ['pombo'], message: MSG }),
    UnknownChannel,
  );
});

test('contato inexistente devolve erro de domínio específico', async () => {
  const core = buildCore();
  await assert.rejects(() => core.send.execute({ contactId: 999, channels: ['fake'], message: MSG }), ContactNotFound);
});

test('limite de 5/min usa o relógio injetado, não o tempo real', async () => {
  const { core, contact } = await comContato();
  for (let i = 0; i < 5; i++) {
    await core.send.execute({ contactId: contact.id!, channels: ['fake'], message: MSG });
  }
  await assert.rejects(() => core.send.execute({ contactId: contact.id!, channels: ['fake'], message: MSG }), RateLimited);

  core.clock.advance(61_000); // passa do minuto sem esperar
  const depois = await core.send.execute({ contactId: contact.id!, channels: ['fake'], message: MSG });
  assert.equal(depois[0].status, 'SENT');
});

test('canais repetidos são deduplicados', async () => {
  const { core, contact } = await comContato();
  const result = await core.send.execute({ contactId: contact.id!, channels: ['fake', 'fake'], message: MSG });
  assert.equal(result.length, 1);
  assert.equal((await core.inbox.execute(contact.id!)).length, 1);
});

test('falha do provedor vira FAILED com attempts 1 e o motivo do provedor', async () => {
  const core = buildCore({ smsFailure: new Error('operadora de SMS indisponível') });
  const contact = await core.createContact.execute({ name: 'Eva', phone: '+5511999998888' });
  const [n] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: MSG });

  assert.equal(n.status, 'FAILED');
  assert.equal(n.attempts, 1);
  assert.match(n.lastError!, /operadora/);
});

test('reenvio reusa a regra de canal: SMS > 160 é rejeitado (ADR-001)', async () => {
  const core = buildCore();
  const contact = await core.createContact.execute({ name: 'Fabio', phone: '+5511999998888' });
  const [criada] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: 'a'.repeat(161) });
  assert.match(criada.lastError!, /160/);

  await assert.rejects(() => core.retry.execute(criada.id!), ChannelRejected);
});

test('reenvio reusa a regra de canal: e-mail sem subject é rejeitado (ADR-001)', async () => {
  const core = buildCore();
  const contact = await core.createContact.execute({ name: 'Gil', email: 'gil@ifrs.edu.br' });
  const [criada] = await core.send.execute({ contactId: contact.id!, channels: ['email'], message: MSG });
  assert.match(criada.lastError!, /exige subject/);

  await assert.rejects(() => core.retry.execute(criada.id!), ChannelRejected);
});

test('reenvio de notificação já enviada ou no limite de tentativas é barrado', async () => {
  const core = buildCore({ smsFailure: new Error('operadora de SMS indisponível') });
  const contact = await core.createContact.execute({ name: 'Helo', phone: '+5511999998888' });

  const [enviadaFake] = await core.send.execute({ contactId: contact.id!, channels: ['fake'], message: MSG });
  await assert.rejects(() => core.retry.execute(enviadaFake.id!), AlreadySent);

  const [sms] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: MSG });
  await core.retry.execute(sms.id!).catch(() => {});
  await core.retry.execute(sms.id!).catch(() => {});
  const noLimite = (await core.notifications.findById(sms.id!))!;
  assert.equal(noLimite.attempts, 3);
  await assert.rejects(() => core.retry.execute(sms.id!), RetryLimitReached);
});

test('reenvio bem-sucedido incrementa attempts e limpa o erro', async () => {
  const core = buildCore({ smsFailure: new Error('operadora de SMS indisponível') });
  const contact = await core.createContact.execute({ name: 'Ivo', phone: '+5511999998888' });
  const [sms] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: MSG });
  assert.equal(sms.status, 'FAILED');

  // provedor volta a responder: o mesmo caso de uso, com outro dublê
  const recuperado = buildCore();
  await recuperado.contacts.save(contact);
  await recuperado.notifications.save(sms);
  const atualizada = await recuperado.retry.execute(sms.id!);

  assert.equal(atualizada.status, 'SENT');
  assert.equal(atualizada.attempts, 2);
  assert.equal(atualizada.lastError, null);
});

test('reenvio com provedor ainda fora devolve DeliveryFailed com a notificação atualizada', async () => {
  const core = buildCore({ smsFailure: new Error('operadora de SMS indisponível') });
  const contact = await core.createContact.execute({ name: 'Joana', phone: '+5511999998888' });
  const [sms] = await core.send.execute({ contactId: contact.id!, channels: ['sms'], message: MSG });

  await assert.rejects(
    () => core.retry.execute(sms.id!),
    (e: unknown) => {
      assert.ok(e instanceof DeliveryFailed);
      const carregada = e.notification as { attempts: number; status: string };
      assert.equal(carregada.attempts, 2);
      assert.equal(carregada.status, 'FAILED');
      return true;
    },
  );
});

test('reenvio de notificação inexistente', async () => {
  const core = buildCore();
  await assert.rejects(() => core.retry.execute(999), NotificationNotFound);
});

test('caixa de entrada do canal fake é lida pela porta', async () => {
  const core = buildCore();
  const contact = await core.createContact.execute({ name: 'Lia', email: 'lia@ifrs.edu.br' });
  await core.send.execute({ contactId: contact.id!, channels: ['fake'], subject: 'Oi', message: MSG });

  const inbox = await core.inbox.execute(contact.id!);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].contactId, contact.id);
  assert.equal(inbox[0].subject, 'Oi');
});

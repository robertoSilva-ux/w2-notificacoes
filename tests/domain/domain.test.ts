import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Channel } from '../../src/domain/channel.js';
import { channelCatalogue } from '../../src/main/catalogue.js';
import { Contact } from '../../src/domain/contact.js';
import { rejectionFor } from '../../src/domain/delivery.js';
import { AlreadySent, InvalidContact, RetryLimitReached, UnknownChannel } from '../../src/domain/errors.js';
import { Notification } from '../../src/domain/notification.js';

const now = new Date('2026-01-01T12:00:00Z');
// atalhos: o canal vem do catálogo (ponto de extensão) e o contato recebe o catálogo
const channel = (name: string) => Channel.from(name, channelCatalogue);
const createContact = (input: Parameters<typeof Contact.create>[0]) => Contact.create(input, channelCatalogue);

test('Contact.create normaliza nome e aceita e-mail ou telefone', () => {
  const c = createContact({ name: '  Ana  ', email: 'ana@ifrs.edu.br' });
  assert.equal(c.name, 'Ana');
  assert.equal(c.email, 'ana@ifrs.edu.br');
  assert.equal(c.phone, null);
  assert.deepEqual(c.optOut, []);
});

test('Contact.create aplica R1–R5 com as mensagens do contrato', () => {
  assert.throws(() => createContact({ name: 'A', email: 'a@b.com' }), (e: unknown) => e instanceof InvalidContact && /mínimo 2/.test((e as Error).message));
  assert.throws(() => createContact({ name: 'Ana', email: 'ana@' }), (e: unknown) => e instanceof InvalidContact && /email inválido/.test((e as Error).message));
  assert.throws(() => createContact({ name: 'Ana', phone: '5551999998888' }), (e: unknown) => e instanceof InvalidContact && /E\.164/.test((e as Error).message));
  assert.throws(() => createContact({ name: 'Ana' }), (e: unknown) => e instanceof InvalidContact && /ao menos email ou phone/.test((e as Error).message));
  assert.throws(() => createContact({ name: 'Ana', email: 'a@b.com', optOut: ['pombo'] }), (e: unknown) => e instanceof InvalidContact && /optOut/.test((e as Error).message));
});

test('Contact guarda optOut como coleção de canais, sem repetição', () => {
  const c = createContact({ name: 'Ana', email: 'a@b.com', optOut: ['sms', 'sms', 'email'] });
  assert.deepEqual(c.optOut.map((x) => x.name), ['sms', 'email']);
  assert.equal(c.hasOptedOutOf(channel('sms')), true);
  assert.equal(c.hasOptedOutOf(channel('fake')), false);
});

test('Channel descreve as exigências de cada canal (R10–R12)', () => {
  assert.equal(channel('sms').requiresPhone, true);
  assert.equal(channel('sms').maxMessageLength, 160);
  assert.equal(channel('email').requiresEmail, true);
  assert.equal(channel('email').requiresSubject, true);
  assert.equal(channel('fake').maxMessageLength, null);
  assert.throws(() => channel('pombo'), UnknownChannel);
});

test('rejectionFor aplica as regras na ordem do contrato', () => {
  const semTelefone = createContact({ name: 'Ana', email: 'ana@ifrs.edu.br' });
  const optOutSms = createContact({ name: 'Beto', email: 'beto@ifrs.edu.br', phone: '+5511999998888', optOut: ['sms'] });

  assert.match(rejectionFor(optOutSms, channel('sms'), 'oi', null)!, /optou por não receber sms/);
  assert.match(rejectionFor(semTelefone, channel('sms'), 'oi', null)!, /não possui telefone/);
  assert.match(rejectionFor(createContact({ name: 'Caio', phone: '+5511999998888' }), channel('sms'), 'a'.repeat(161), null)!, /160/);
  assert.equal(rejectionFor(createContact({ name: 'Caio', phone: '+5511999998888' }), channel('sms'), 'a'.repeat(160), null), null);
  const soTelefone = createContact({ name: 'Caio', phone: '+5511999998888' });
  assert.match(rejectionFor(soTelefone, channel('email'), 'oi', 'Assunto')!, /não possui email/);
  assert.match(rejectionFor(createContact({ name: 'Dora', email: 'dora@ifrs.edu.br' }), channel('email'), 'oi', null)!, /exige subject/);
  assert.equal(rejectionFor(semTelefone, channel('fake'), 'oi', null), null);
});

test('Notification: ciclo de vida e regras de reenvio (R13–R16)', () => {
  const base = { contactId: 1, channel: channel('sms'), subject: null, message: 'oi' };
  const pendente = Notification.create(base, now).withId(1);
  assert.equal(pendente.status, 'PENDING');
  assert.equal(pendente.attempts, 0);
  pendente.assertRetryable();

  const enviada = pendente.markSent('sms-1', now);
  assert.equal(enviada.status, 'SENT');
  assert.equal(enviada.attempts, 1);
  assert.ok(enviada.sentAt);
  assert.throws(() => enviada.assertRetryable(), AlreadySent);

  const falha = pendente.markFailed('operadora indisponível');
  assert.equal(falha.status, 'FAILED');
  assert.equal(falha.attempts, 1);
  assert.equal(falha.providerId, null);
  falha.assertRetryable();

  const noLimite = Notification.rehydrate({ ...falha.toProps(), attempts: 3 });
  assert.throws(() => noLimite.assertRetryable(), RetryLimitReached);

  const barrada = Notification.rejected(base, 'contato optou por não receber sms', now);
  assert.equal(barrada.status, 'FAILED');
  assert.equal(barrada.attempts, 0, 'barrada por regra não conta tentativa de entrega');
});

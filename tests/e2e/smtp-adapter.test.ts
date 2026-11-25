import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Transporter } from 'nodemailer';
import { SmtpEmailChannel } from '../../src/adapters/out/channels/smtp-email-channel.js';
import { SequenceIds } from '../helpers/doubles.ts';

test('adaptador SMTP entrega pela porta MessageSender (sem tocar em domínio/casos de uso)', async () => {
  // transporte dublê: verifica o que o adaptador manda para o provedor, sem rede
  const sent: any[] = [];
  const transporter = {
    sendMail: async (message: any) => {
      sent.push(message);
      return { messageId: '<abc@exemplo>' };
    },
  };
  const channel = new SmtpEmailChannel({
    host: 'smtp.exemplo',
    port: 587,
    secure: false,
    user: 'u',
    pass: 'p',
    from: 'no-reply@exemplo',
    ids: new SequenceIds(),
    transporter: transporter as unknown as Transporter,
  });

  const receipt = await channel.send({
    channel: 'email',
    contactId: 1,
    contactName: 'Ana',
    email: 'ana@ifrs.edu.br',
    phone: null,
    subject: 'Assunto',
    message: 'Corpo',
  });

  assert.equal(receipt.providerId, '<abc@exemplo>');
  assert.deepEqual(sent[0], { from: 'no-reply@exemplo', to: 'ana@ifrs.edu.br', subject: 'Assunto', text: 'Corpo' });
});

import type { ChannelSpec } from '../channel.js';

/** Canal SMS: exige telefone e tem limite de 160 caracteres. */
export const smsChannel: ChannelSpec = {
  name: 'sms',
  requiresPhone: true,
  requiresEmail: false,
  requiresSubject: false,
  maxMessageLength: 160,
};

import type { ChannelSpec } from '../channel.js';

/** Canal de e-mail: exige endereço e assunto. */
export const emailChannel: ChannelSpec = {
  name: 'email',
  requiresPhone: false,
  requiresEmail: true,
  requiresSubject: true,
  maxMessageLength: null,
};

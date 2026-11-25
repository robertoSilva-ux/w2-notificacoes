import type { ChannelSpec } from '../channel.js';

/** Canal `fake`: entrega local, sem exigências de contato. */
export const fakeChannel: ChannelSpec = {
  name: 'fake',
  requiresPhone: false,
  requiresEmail: false,
  requiresSubject: false,
  maxMessageLength: null,
};

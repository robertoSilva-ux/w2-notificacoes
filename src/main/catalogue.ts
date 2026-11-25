import { Channel, type ChannelCatalogue } from '../domain/channel.js';
import { fakeChannel } from '../domain/channels/fake.js';
import { smsChannel } from '../domain/channels/sms.js';
import { emailChannel } from '../domain/channels/email.js';
import { whatsappChannel } from '../domain/channels/whatsapp.js';

/**
 * Catálogo de canais do sistema, montado no composition root.
 *
 * Este é o ponto de extensão: um canal novo entra aqui (uma linha) junto com a sua
 * descrição em `src/domain/channels/` e o seu adaptador em `src/adapters/out/channels/`.
 * Nenhum arquivo do domínio existente e nenhum caso de uso precisa mudar.
 */
const SPECS = [fakeChannel, smsChannel, emailChannel, whatsappChannel] as const;

export const channelCatalogue: ChannelCatalogue = {
  find: (name: string) => SPECS.find((spec) => spec.name === name) ?? null,
  all: () => SPECS,
};

/** Atalho usado pelos testes e pelo container. */
export const channel = (name: string): Channel => Channel.from(name, channelCatalogue);

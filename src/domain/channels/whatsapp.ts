import type { ChannelSpec } from '../channel.js';

/**
 * Canal WhatsApp (Etapa 9). Descrição nova, sem tocar em nada do domínio existente:
 * exige telefone, não exige assunto, limite de mensagem de 4096 caracteres.
 */
export const whatsappChannel: ChannelSpec = {
  name: 'whatsapp',
  requiresPhone: true,
  requiresEmail: false,
  requiresSubject: false,
  maxMessageLength: 4096,
};

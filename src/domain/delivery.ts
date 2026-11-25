import type { Channel } from './channel.js';
import type { Contact } from './contact.js';

/**
 * A regra de canal, em um único lugar (ADR-001).
 *
 * Envio e reenvio chamam exatamente esta função: rejeitar no reenvio o que o envio rejeita
 * é consequência de não existir uma segunda cópia da regra.
 *
 * @returns o motivo da rejeição, ou null quando o canal pode entregar.
 */
export function rejectionFor(
  contact: Contact,
  channel: Channel,
  message: string,
  subject: string | null,
): string | null {
  if (contact.hasOptedOutOf(channel)) {
    return `contato optou por não receber ${channel.name}`;
  }
  if (channel.requiresPhone && !contact.phone) {
    return 'contato não possui telefone';
  }
  const max = channel.maxMessageLength;
  if (max !== null && message.length > max) {
    return `mensagem de ${channel.name.toUpperCase()} não pode passar de ${max} caracteres`;
  }
  if (channel.requiresEmail && !contact.email) {
    return 'contato não possui email';
  }
  if (channel.requiresSubject && !subject) {
    return `${channel.name} exige subject`;
  }
  return null;
}

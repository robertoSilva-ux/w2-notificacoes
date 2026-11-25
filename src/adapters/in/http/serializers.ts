import type { Contact } from '../../../domain/contact.js';
import type { Notification } from '../../../domain/notification.js';

/** Formato de contato nas rotas de contato: `optOut` como array (contrato original). */
export function contactJson(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    optOut: contact.optOut.map((c) => c.name),
    createdAt: contact.createdAt,
  };
}

/**
 * Formato do contato embutido no detalhe da notificação: `optOut` como string CSV,
 * exatamente como o original devolvia o registro do banco (assimetria D5 preservada).
 */
export function embeddedContactJson(contact: Contact | null) {
  if (!contact) return null;
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    optOut: contact.optOut.map((c) => c.name).join(','),
    createdAt: contact.createdAt,
  };
}

export function notificationJson(notification: Notification) {
  return {
    id: notification.id,
    channel: notification.channel.name,
    subject: notification.subject,
    message: notification.message,
    status: notification.status,
    attempts: notification.attempts,
    lastError: notification.lastError,
    providerId: notification.providerId,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
    contactId: notification.contactId,
  };
}

export function deliveredMessageJson(message: {
  id: string;
  contactId: number;
  subject: string | null;
  message: string;
  receivedAt: Date;
}) {
  return {
    id: message.id,
    contactId: message.contactId,
    subject: message.subject,
    message: message.message,
    receivedAt: message.receivedAt,
  };
}

import { rejectionFor } from '../../domain/delivery.js';
import { ChannelRejected, ContactNotFound, DeliveryFailed, NotificationNotFound } from '../../domain/errors.js';
import type { Notification } from '../../domain/notification.js';
import type { ContactRepository } from '../ports/contact-repository.js';
import type { NotificationRepository } from '../ports/notification-repository.js';
import type { DeliveryService } from '../services/delivery-service.js';

export interface RetryNotificationDeps {
  contacts: ContactRepository;
  notifications: NotificationRepository;
  delivery: DeliveryService;
}

/**
 * Caso de uso: reenviar uma notificação que falhou.
 *
 * Reusa `Notification.assertRetryable` (R13), `rejectionFor` (R8–R12, a mesma regra do envio —
 * é isso que o ADR-001 resolve) e `DeliveryService` (a mesma entrega). Nenhuma regra é reescrita aqui.
 */
export class RetryNotification {
  constructor(private readonly deps: RetryNotificationDeps) {}

  async execute(id: number): Promise<Notification> {
    const notification = await this.deps.notifications.findById(id);
    if (!notification) throw new NotificationNotFound();
    notification.assertRetryable();

    const contact = await this.deps.contacts.findById(notification.contactId);
    if (!contact) throw new ContactNotFound();

    const rejection = rejectionFor(contact, notification.channel, notification.message, notification.subject);
    if (rejection) throw new ChannelRejected(rejection);

    const updated = await this.deps.notifications.save(
      await this.deps.delivery.deliver(notification, contact),
    );
    // o adaptador HTTP traduz DeliveryFailed em 502 com o corpo da notificação
    if (updated.status === 'FAILED') throw new DeliveryFailed(updated.lastError ?? 'falha na entrega', updated);
    return updated;
  }
}

import type { Contact } from '../../domain/contact.js';
import { NotificationNotFound } from '../../domain/errors.js';
import type { Notification } from '../../domain/notification.js';
import type { ContactRepository } from '../ports/contact-repository.js';
import type { NotificationFilter, NotificationRepository } from '../ports/notification-repository.js';

export class ListNotifications {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(filter: NotificationFilter): Promise<Notification[]> {
    return this.notifications.findMany(filter);
  }
}

/** Detalhe: o contrato da rota embute o contato, então o caso de uso devolve os dois. */
export class GetNotification {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly contacts: ContactRepository,
  ) {}

  async execute(id: number): Promise<{ notification: Notification; contact: Contact | null }> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotificationNotFound();
    const contact = await this.contacts.findById(notification.contactId);
    return { notification, contact };
  }
}

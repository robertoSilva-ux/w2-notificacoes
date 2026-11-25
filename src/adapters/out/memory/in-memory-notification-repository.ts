import type {
  NotificationFilter,
  NotificationRepository,
} from '../../../application/ports/notification-repository.js';
import type { Notification } from '../../../domain/notification.js';

/** Implementação em memória da porta de notificações (testes e boot sem banco). */
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly rows: Notification[] = [];
  private sequence = 0;

  async save(notification: Notification): Promise<Notification> {
    if (notification.id === null) {
      const saved = notification.withId(++this.sequence);
      this.rows.push(saved);
      return saved;
    }
    const index = this.rows.findIndex((n) => n.id === notification.id);
    if (index >= 0) this.rows[index] = notification;
    else this.rows.push(notification);
    return notification;
  }

  async findById(id: number): Promise<Notification | null> {
    return this.rows.find((n) => n.id === id) ?? null;
  }

  async findMany(filter: NotificationFilter): Promise<Notification[]> {
    return this.rows
      .filter((n) => (filter.status ? n.status === filter.status : true))
      .filter((n) => (filter.channel ? n.channel.name === filter.channel : true))
      .filter((n) => (filter.contactId !== undefined ? n.contactId === filter.contactId : true))
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }

  async countSince(contactId: number, since: Date): Promise<number> {
    return this.rows.filter((n) => n.contactId === contactId && n.createdAt >= since).length;
  }
}

import type { Notification, NotificationStatus } from '../../domain/notification.js';

export interface NotificationFilter {
  readonly status?: NotificationStatus;
  readonly channel?: string;
  readonly contactId?: number;
}

/** Porta de persistência de notificações, na linguagem do domínio. */
export interface NotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findById(id: number): Promise<Notification | null>;
  findMany(filter: NotificationFilter): Promise<Notification[]>;
  /** Quantas notificações o contato recebeu a partir de `since` (base do limite R7). */
  countSince(contactId: number, since: Date): Promise<number>;
}

import type { PrismaClient } from '@prisma/client';
import type {
  NotificationFilter,
  NotificationRepository,
} from '../../../application/ports/notification-repository.js';
import { Channel, type ChannelCatalogue } from '../../../domain/channel.js';
import { Notification, type NotificationStatus } from '../../../domain/notification.js';

interface NotificationRow {
  id: number;
  contactId: number;
  channel: string;
  subject: string | null;
  message: string;
  status: string;
  attempts: number;
  lastError: string | null;
  providerId: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

/** Adaptador de persistência de notificações; o Prisma fica confinado neste arquivo. */
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogue: ChannelCatalogue,
  ) {}

  async save(notification: Notification): Promise<Notification> {
    const data = {
      contactId: notification.contactId,
      channel: notification.channel.name,
      subject: notification.subject,
      message: notification.message,
      status: notification.status,
      attempts: notification.attempts,
      lastError: notification.lastError,
      providerId: notification.providerId,
      createdAt: notification.createdAt,
      sentAt: notification.sentAt,
    };

    if (notification.id === null) {
      return toDomain(await this.prisma.notification.create({ data }), this.catalogue);
    }
    const row = await this.prisma.notification.update({ where: { id: notification.id }, data });
    return toDomain(row, this.catalogue);
  }

  async findById(id: number): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row ? toDomain(row, this.catalogue) : null;
  }

  async findMany(filter: NotificationFilter): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.channel ? { channel: filter.channel } : {}),
        ...(filter.contactId !== undefined ? { contactId: filter.contactId } : {}),
      },
      orderBy: { id: 'desc' },
    });
    return rows.map((row) => toDomain(row, this.catalogue));
  }

  async countSince(contactId: number, since: Date): Promise<number> {
    return this.prisma.notification.count({ where: { contactId, createdAt: { gte: since } } });
  }
}

function toDomain(row: NotificationRow, catalogue: ChannelCatalogue): Notification {
  return Notification.rehydrate({
    id: row.id,
    contactId: row.contactId,
    channel: Channel.from(row.channel, catalogue),
    subject: row.subject,
    message: row.message,
    status: row.status as NotificationStatus,
    attempts: row.attempts,
    lastError: row.lastError,
    providerId: row.providerId,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  });
}

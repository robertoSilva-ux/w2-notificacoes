import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { FakeChannel } from '../adapters/out/memory/fake-channel.js';
import { InMemoryContactRepository } from '../adapters/out/memory/in-memory-contact-repository.js';
import { InMemoryNotificationRepository } from '../adapters/out/memory/in-memory-notification-repository.js';
import { LogEmailChannel } from '../adapters/out/channels/email-channel.js';
import { SmtpEmailChannel } from '../adapters/out/channels/smtp-email-channel.js';
import { WhatsappChannel } from '../adapters/out/channels/whatsapp-channel.js';
import { SmsChannel } from '../adapters/out/channels/sms-channel.js';
import { PrismaContactRepository } from '../adapters/out/prisma/prisma-contact-repository.js';
import { PrismaNotificationRepository } from '../adapters/out/prisma/prisma-notification-repository.js';
import { CryptoIds, MathRandom, SystemClock } from '../adapters/out/system/system.js';
import type { HttpDeps } from '../adapters/in/http/app.js';
import type { Clock, IdGenerator } from '../application/ports/clock.js';
import type { ContactRepository } from '../application/ports/contact-repository.js';
import type { SenderRegistry } from '../application/ports/message-sender.js';
import type { NotificationRepository } from '../application/ports/notification-repository.js';
import { DeliveryService } from '../application/services/delivery-service.js';
import { GetContact, ListContacts } from '../application/use-cases/contacts.js';
import { CreateContact } from '../application/use-cases/create-contact.js';
import { ListDeliveredMessages } from '../application/use-cases/list-delivered-messages.js';
import { GetNotification, ListNotifications } from '../application/use-cases/notifications.js';
import { RetryNotification } from '../application/use-cases/retry-notification.js';
import { SendNotifications } from '../application/use-cases/send-notifications.js';
import { channelCatalogue } from './catalogue.js';
import type { AppConfig } from './config.js';

export interface Container {
  /** casos de uso prontos para qualquer adaptador primário (HTTP, CLI, ...) */
  readonly uses: HttpDeps;
  close(): Promise<void>;
}

/**
 * Composition root: o único lugar que instancia implementações concretas e as conecta
 * às portas. Trocando `storage` para `memory`, a aplicação inteira sobe sem Prisma.
 */
export function buildContainer(config: AppConfig): Container {
  const clock: Clock = new SystemClock();
  const ids: IdGenerator = new CryptoIds();
  const random = new MathRandom();

  let prisma: PrismaClient | null = null;
  let contacts: ContactRepository;
  let notifications: NotificationRepository;

  if (config.storage === 'memory') {
    contacts = new InMemoryContactRepository(clock);
    notifications = new InMemoryNotificationRepository();
  } else {
    prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: config.databaseUrl! }) });
    contacts = new PrismaContactRepository(prisma, channelCatalogue);
    notifications = new PrismaNotificationRepository(prisma, channelCatalogue);
  }

  const fake = new FakeChannel(ids, clock);
  const email =
    config.emailProvider === 'smtp' && config.smtp
      ? new SmtpEmailChannel({ ...config.smtp, from: config.mailFrom, ids })
      : new LogEmailChannel({ ids });

  const senders: SenderRegistry = {
    fake,
    sms: new SmsChannel({ failureRate: config.smsFailureRate, random, ids }),
    email,
    whatsapp: new WhatsappChannel({ ids }),
  };
  const delivery = new DeliveryService(senders, clock);

  const uses: HttpDeps = {
    createContact: new CreateContact(contacts, channelCatalogue),
    listContacts: new ListContacts(contacts),
    getContact: new GetContact(contacts),
    sendNotifications: new SendNotifications({
      contacts,
      catalogue: channelCatalogue,
      notifications,
      delivery,
      clock,
      maxPerMinute: config.maxPerMinute,
    }),
    retryNotification: new RetryNotification({ contacts, notifications, delivery }),
    listNotifications: new ListNotifications(notifications),
    getNotification: new GetNotification(notifications, contacts),
    listDeliveredMessages: new ListDeliveredMessages(fake),
  };

  return {
    uses,
    close: async () => {
      await prisma?.$disconnect();
    },
  };
}

// Monta o núcleo (casos de uso + portas em memória) sem HTTP, sem banco e sem tempo real.
import { channelCatalogue } from '../../src/main/catalogue.js';
import { FakeChannel } from '../../src/adapters/out/memory/fake-channel.js';
import { InMemoryContactRepository } from '../../src/adapters/out/memory/in-memory-contact-repository.js';
import { InMemoryNotificationRepository } from '../../src/adapters/out/memory/in-memory-notification-repository.js';
import type { Clock } from '../../src/application/ports/clock.js';
import type { MessageSender, SenderRegistry } from '../../src/application/ports/message-sender.js';
import { DeliveryService } from '../../src/application/services/delivery-service.js';
import { CreateContact } from '../../src/application/use-cases/create-contact.js';
import { GetContact, ListContacts } from '../../src/application/use-cases/contacts.js';
import { ListDeliveredMessages } from '../../src/application/use-cases/list-delivered-messages.js';
import { GetNotification, ListNotifications } from '../../src/application/use-cases/notifications.js';
import { RetryNotification } from '../../src/application/use-cases/retry-notification.js';
import { SendNotifications } from '../../src/application/use-cases/send-notifications.js';
import { FixedClock, RecordingSender, SequenceIds } from '../helpers/doubles.js';

export interface Core {
  clock: FixedClock;
  contacts: InMemoryContactRepository;
  notifications: InMemoryNotificationRepository;
  fake: FakeChannel;
  smsSender: RecordingSender;
  emailSender: RecordingSender;
  createContact: CreateContact;
  listContacts: ListContacts;
  getContact: GetContact;
  send: SendNotifications;
  retry: RetryNotification;
  listNotifications: ListNotifications;
  getNotification: GetNotification;
  inbox: ListDeliveredMessages;
}

export interface CoreOptions {
  clock?: FixedClock;
  smsFailure?: Error;
  emailFailure?: Error;
  maxPerMinute?: number;
}

export function buildCore(options: CoreOptions = {}): Core {
  const clock: FixedClock = options.clock ?? new FixedClock();
  const ids = new SequenceIds();
  const contacts = new InMemoryContactRepository();
  const notifications = new InMemoryNotificationRepository();

  const fake = new FakeChannel(ids, clock);
  const smsSender = new RecordingSender(options.smsFailure);
  const emailSender = new RecordingSender(options.emailFailure);

  const senders: SenderRegistry = {
    fake: fake,
    sms: smsSender,
    email: emailSender,
  };
  const delivery = new DeliveryService(senders, clock as Clock);

  return {
    clock,
    contacts,
    notifications,
    fake,
    smsSender,
    emailSender,
    createContact: new CreateContact(contacts, channelCatalogue),
    listContacts: new ListContacts(contacts),
    getContact: new GetContact(contacts),
    send: new SendNotifications({
      contacts,
      catalogue: channelCatalogue,
      notifications,
      delivery,
      clock,
      maxPerMinute: options.maxPerMinute ?? 5,
    }),
    retry: new RetryNotification({ contacts, notifications, delivery }),
    listNotifications: new ListNotifications(notifications),
    getNotification: new GetNotification(notifications, contacts),
    inbox: new ListDeliveredMessages(fake),
  };
}

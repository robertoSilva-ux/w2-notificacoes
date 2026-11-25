import { Channel, type ChannelCatalogue } from '../../domain/channel.js';
import type { Contact } from '../../domain/contact.js';
import { rejectionFor } from '../../domain/delivery.js';
import { ContactNotFound, RateLimited } from '../../domain/errors.js';
import { Notification } from '../../domain/notification.js';
import type { Clock } from '../ports/clock.js';
import type { ContactRepository } from '../ports/contact-repository.js';
import type { NotificationRepository } from '../ports/notification-repository.js';
import type { DeliveryService } from '../services/delivery-service.js';

export interface SendNotificationsInput {
  contactId: number;
  /** nomes de canal como chegaram do adaptador; a conversão (e a validação) é do domínio */
  channels: string[];
  message: string;
  subject?: string | null;
}

export interface SendNotificationsDeps {
  contacts: ContactRepository;
  catalogue: ChannelCatalogue;
  notifications: NotificationRepository;
  delivery: DeliveryService;
  clock: Clock;
  maxPerMinute: number;
}

/**
 * Caso de uso: enviar uma mensagem para um contato por um ou mais canais.
 *
 * Ordem preservada do original: validação de canal → contato → limite por minuto → por canal.
 * A decisão de *poder entregar* vem do domínio (`rejectionFor`); este caso de uso só orquestra.
 */
export class SendNotifications {
  constructor(private readonly deps: SendNotificationsDeps) {}

  async execute(input: SendNotificationsInput): Promise<Notification[]> {
    const channels = input.channels.map((name) => Channel.from(name, this.deps.catalogue));

    const contact = await this.deps.contacts.findById(input.contactId);
    if (!contact) throw new ContactNotFound();

    const now = this.deps.clock.now();
    const windowStart = new Date(now.getTime() - 60_000);
    const recent = await this.deps.notifications.countSince(contact.id!, windowStart);
    if (recent + input.channels.length > this.deps.maxPerMinute) {
      throw new RateLimited(this.deps.maxPerMinute);
    }

    const subject = input.subject ?? null;
    const results: Notification[] = [];
    for (const channel of dedupe(channels)) {
      const draft = { contactId: contact.id!, channel, subject, message: input.message };
      const rejection = rejectionFor(contact, channel, input.message, subject);

      let notification = rejection
        ? Notification.rejected(draft, rejection, now)
        : Notification.create(draft, now);
      notification = await this.deps.notifications.save(notification);

      if (!rejection) {
        notification = await this.deps.notifications.save(
          await this.deps.delivery.deliver(notification, contact),
        );
      }
      results.push(notification);
    }
    return results;
  }
}

function dedupe(channels: Channel[]): Channel[] {
  const seen = new Set<string>();
  return channels.filter((channel) => {
    if (seen.has(channel.name)) return false;
    seen.add(channel.name);
    return true;
  });
}

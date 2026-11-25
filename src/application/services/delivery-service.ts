import type { Contact } from '../../domain/contact.js';
import type { Notification } from '../../domain/notification.js';
import type { Clock } from '../ports/clock.js';
import type { SenderRegistry } from '../ports/message-sender.js';

/**
 * Uma única forma de entregar uma notificação, usada pelo envio e pelo reenvio (ADR-001).
 * Não lança: falha de provedor vira notificação FAILED, como no contrato original.
 */
export class DeliveryService {
  constructor(
    private readonly senders: SenderRegistry,
    private readonly clock: Clock,
  ) {}

  async deliver(notification: Notification, contact: Contact): Promise<Notification> {
    const sender = this.senders[notification.channel.name];
    try {
      const receipt = await sender.send({
        channel: notification.channel.name,
        contactId: contact.id ?? notification.contactId,
        contactName: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: notification.subject,
        message: notification.message,
      });
      return notification.markSent(receipt.providerId, this.clock.now());
    } catch (error) {
      return notification.markFailed(error instanceof Error ? error.message : String(error));
    }
  }
}

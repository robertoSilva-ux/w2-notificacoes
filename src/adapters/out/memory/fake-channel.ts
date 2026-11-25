import type { DeliveredMessage, DeliveredMessages } from '../../../application/ports/delivered-messages.js';
import type { IdGenerator } from '../../../application/ports/clock.js';
import type { Clock } from '../../../application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../../application/ports/message-sender.js';

/**
 * Canal `fake` (ADR-004): entrega guardando a mensagem em memória, do mesmo jeito que o
 * array global do arquivo original — só que agora com dono, injetável e com leitura pela porta.
 */
export class FakeChannel implements MessageSender, DeliveredMessages {
  private readonly messages: DeliveredMessage[] = [];

  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async send(message: OutgoingMessage): Promise<Receipt> {
    const providerId = `fake-${this.ids.newId()}`;
    this.messages.push({
      id: providerId,
      contactId: message.contactId,
      subject: message.subject,
      message: message.message,
      receivedAt: this.clock.now(),
    });
    return { providerId };
  }

  async forContact(contactId: number): Promise<DeliveredMessage[]> {
    return this.messages.filter((m) => m.contactId === contactId);
  }
}

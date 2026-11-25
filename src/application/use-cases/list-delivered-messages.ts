import type { DeliveredMessage, DeliveredMessages } from '../ports/delivered-messages.js';

/** Lê a caixa de entrada do canal `fake` (contrato de `/fake-inbox/:contactId`). */
export class ListDeliveredMessages {
  constructor(private readonly inbox: DeliveredMessages) {}

  async execute(contactId: number): Promise<DeliveredMessage[]> {
    return this.inbox.forContact(contactId);
  }
}

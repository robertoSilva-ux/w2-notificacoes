/** Mensagem que o canal `fake` guardou, para inspeção em `/fake-inbox/:contactId`. */
export interface DeliveredMessage {
  readonly id: string;
  readonly contactId: number;
  readonly subject: string | null;
  readonly message: string;
  readonly receivedAt: Date;
}

/** Porta de leitura da caixa de entrada do canal `fake` (ADR-004). */
export interface DeliveredMessages {
  forContact(contactId: number): Promise<DeliveredMessage[]>;
}

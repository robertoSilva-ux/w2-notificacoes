/** Mensagem pronta para entrega, na linguagem do negócio (não do provedor). */
export interface OutgoingMessage {
  readonly channel: string;
  readonly contactId: number;
  readonly contactName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly subject: string | null;
  readonly message: string;
}

/** Recibo devolvido pelo provedor: o identificador da entrega. */
export interface Receipt {
  readonly providerId: string;
}

/**
 * Porta de saída de entrega (ADR-002): uma porta só, um adaptador por canal,
 * registrados no composition root pelo nome do canal.
 */
export interface MessageSender {
  send(message: OutgoingMessage): Promise<Receipt>;
}

export type SenderRegistry = Readonly<Record<string, MessageSender>>;

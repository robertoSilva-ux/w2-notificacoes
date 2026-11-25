/**
 * Erros de domínio. Nenhum deles conhece HTTP: quem traduz para status é o adaptador
 * primário, em um único mapa (ver src/adapters/in/http/error-handler.ts).
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Regra de contato violada na criação (R1–R5). */
export class InvalidContact extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_CONTACT');
  }
}

/** Canal que não existe no sistema (R6). */
export class UnknownChannel extends DomainError {
  constructor(readonly channel: string) {
    super(`canal desconhecido: ${channel}`, 'UNKNOWN_CHANNEL');
  }
}

/** Contato inexistente. */
export class ContactNotFound extends DomainError {
  constructor() {
    super('contato não encontrado', 'CONTACT_NOT_FOUND');
  }
}

/** Notificação inexistente. */
export class NotificationNotFound extends DomainError {
  constructor() {
    super('notificação não encontrada', 'NOTIFICATION_NOT_FOUND');
  }
}

/** Já entregue: não se reenvia (R13). */
export class AlreadySent extends DomainError {
  constructor() {
    super('notificação já foi enviada', 'ALREADY_SENT');
  }
}

/** Limite de tentativas atingido (R13). */
export class RetryLimitReached extends DomainError {
  constructor() {
    super('número máximo de tentativas (3) atingido', 'RETRY_LIMIT_REACHED');
  }
}

/** Limite de envios por minuto (R7). */
export class RateLimited extends DomainError {
  constructor(perMinute: number) {
    super(`limite de ${perMinute} notificações por minuto para este contato`, 'RATE_LIMITED');
  }
}

/** Uma regra do canal barrou a entrega (R8–R12) no caminho de reenvio. */
export class ChannelRejected extends DomainError {
  constructor(reason: string) {
    super(reason, 'CHANNEL_REJECTED');
  }
}

/** O provedor falhou ao entregar; carrega a notificação já atualizada. */
export class DeliveryFailed extends DomainError {
  constructor(
    reason: string,
    readonly notification: unknown,
  ) {
    super(reason, 'DELIVERY_FAILED');
  }
}

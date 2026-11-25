import type { IdGenerator } from '../../../application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../../application/ports/message-sender.js';
import { realSleep } from '../system/system.js';

export interface EmailChannelOptions {
  ids: IdGenerator;
  /** latência simulada do SMTP, em ms */
  latencyMs?: number;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Adaptador do canal de e-mail "simulado" (imprime no console).
 * Na Etapa 9 esta porta ganha um segundo adaptador com SMTP real, escolhido por configuração.
 */
export class LogEmailChannel implements MessageSender {
  constructor(private readonly options: EmailChannelOptions) {}

  async send(message: OutgoingMessage): Promise<Receipt> {
    await (this.options.sleep ?? realSleep)(this.options.latencyMs ?? 300);
    const providerId = `<${this.options.ids.newId()}@notificacoes.local>`;
    (this.options.log ?? console.log)(
      `[EMAIL] From: no-reply@notificacoes.local\n        To: ${message.contactName} <${message.email}>\n        Subject: ${message.subject}\n\n        ${message.message}`,
    );
    return { providerId };
  }
}

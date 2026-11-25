import type { IdGenerator } from '../../../application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../../application/ports/message-sender.js';
import { realSleep } from '../system/system.js';

export interface WhatsappChannelOptions {
  ids: IdGenerator;
  latencyMs?: number;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

/** Adaptador do canal WhatsApp (simulado). Só entrega: as exigências do canal são do domínio. */
export class WhatsappChannel implements MessageSender {
  constructor(private readonly options: WhatsappChannelOptions) {}

  async send(message: OutgoingMessage): Promise<Receipt> {
    await (this.options.sleep ?? realSleep)(this.options.latencyMs ?? 120);
    const providerId = `whatsapp-${this.options.ids.newId().slice(0, 8)}`;
    (this.options.log ?? console.log)(`[WHATSAPP] para ${message.phone}: ${message.message}`);
    return { providerId };
  }
}

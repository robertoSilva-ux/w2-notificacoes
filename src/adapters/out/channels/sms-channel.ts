import type { IdGenerator } from '../../../application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../../application/ports/message-sender.js';
import type { Random } from '../../../application/ports/random.js';
import { realSleep } from '../system/system.js';

export interface SmsChannelOptions {
  /** probabilidade de a "operadora" falhar (SMS_FAILURE_RATE) */
  failureRate: number;
  random: Random;
  ids: IdGenerator;
  /** latência simulada da operadora, em ms */
  latencyMs?: number;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Adaptador do canal SMS. Só entrega: não sabe que SMS tem 160 caracteres nem que exige
 * telefone — isso é regra de canal, e mora no domínio.
 */
export class SmsChannel implements MessageSender {
  constructor(private readonly options: SmsChannelOptions) {}

  async send(message: OutgoingMessage): Promise<Receipt> {
    await (this.options.sleep ?? realSleep)(this.options.latencyMs ?? 150);
    if (this.options.random.next() < this.options.failureRate) {
      throw new Error('operadora de SMS indisponível');
    }
    const providerId = `sms-${this.options.ids.newId().slice(0, 8)}`;
    (this.options.log ?? console.log)(`[SMS] para ${message.phone}: ${message.message}`);
    return { providerId };
  }
}

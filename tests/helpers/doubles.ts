// Dublês das portas: nenhum teste de domínio/caso de uso toca banco, HTTP, relógio real
// ou aleatoriedade (ADR-003).
import type { Clock, IdGenerator } from '../../src/application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../src/application/ports/message-sender.js';

export class FixedClock implements Clock {
  private current: Date;

  constructor(start = new Date('2026-01-01T12:00:00Z')) {
    this.current = start;
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequenceIds implements IdGenerator {
  private sequence = 0;

  newId(): string {
    return `id-${++this.sequence}`;
  }
}

export class RecordingSender implements MessageSender {
  readonly sent: OutgoingMessage[] = [];

  constructor(private readonly failure?: Error) {}

  async send(message: OutgoingMessage): Promise<Receipt> {
    if (this.failure) throw this.failure;
    this.sent.push(message);
    return { providerId: `${message.channel}-ok` };
  }
}

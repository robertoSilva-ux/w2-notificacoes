import { Channel } from './channel.js';
import { AlreadySent, RetryLimitReached } from './errors.js';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export const MAX_ATTEMPTS = 3;

export interface NotificationProps {
  readonly id: number | null;
  readonly contactId: number;
  readonly channel: Channel;
  readonly subject: string | null;
  readonly message: string;
  readonly status: NotificationStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly providerId: string | null;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
}

export interface NewNotification {
  contactId: number;
  channel: Channel;
  subject: string | null;
  message: string;
}

/**
 * Notificação e o seu ciclo de vida (R13–R16).
 * `attempts` conta tentativas de entrega de verdade: uma notificação barrada por regra
 * de canal nasce FAILED com `attempts = 0`, igual ao comportamento original.
 */
export class Notification {
  private constructor(private readonly props: NotificationProps) {}

  static create(input: NewNotification, now: Date): Notification {
    return new Notification({
      id: null,
      contactId: input.contactId,
      channel: input.channel,
      subject: input.subject,
      message: input.message,
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      providerId: null,
      createdAt: now,
      sentAt: null,
    });
  }

  /** Notificação que nunca será entregue porque uma regra de canal a barrou (R14). */
  static rejected(input: NewNotification, reason: string, now: Date): Notification {
    return new Notification({
      id: null,
      contactId: input.contactId,
      channel: input.channel,
      subject: input.subject,
      message: input.message,
      status: 'FAILED',
      attempts: 0,
      lastError: reason,
      providerId: null,
      createdAt: now,
      sentAt: null,
    });
  }

  static rehydrate(props: NotificationProps): Notification {
    return new Notification(props);
  }

  /** @throws AlreadySent | RetryLimitReached (R13) */
  assertRetryable(): void {
    if (this.props.status === 'SENT') throw new AlreadySent();
    if (this.props.attempts >= MAX_ATTEMPTS) throw new RetryLimitReached();
  }

  markSent(providerId: string, at: Date): Notification {
    return new Notification({
      ...this.props,
      status: 'SENT',
      attempts: this.props.attempts + 1,
      lastError: null,
      providerId,
      sentAt: at,
    });
  }

  markFailed(reason: string): Notification {
    return new Notification({
      ...this.props,
      status: 'FAILED',
      attempts: this.props.attempts + 1,
      lastError: reason,
    });
  }

  get id(): number | null {
    return this.props.id;
  }

  get contactId(): number {
    return this.props.contactId;
  }

  get channel(): Channel {
    return this.props.channel;
  }

  get subject(): string | null {
    return this.props.subject;
  }

  get message(): string {
    return this.props.message;
  }

  get status(): NotificationStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  get providerId(): string | null {
    return this.props.providerId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get sentAt(): Date | null {
    return this.props.sentAt;
  }

  withId(id: number): Notification {
    return new Notification({ ...this.props, id });
  }

  /** Cópia imutável dos dados, para adaptadores e para reconstituição em teste. */
  toProps(): NotificationProps {
    return { ...this.props };
  }
}

import nodemailer, { type Transporter } from 'nodemailer';
import type { IdGenerator } from '../../../application/ports/clock.js';
import type { MessageSender, OutgoingMessage, Receipt } from '../../../application/ports/message-sender.js';

export interface SmtpEmailOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  ids: IdGenerator;
  /** injetável para teste/preview */
  transporter?: Transporter;
}

/**
 * Provedor de e-mail REAL (Etapa 9), escolhido por configuração (`EMAIL_PROVIDER=smtp`).
 * Mesma porta, mesmo contrato: o domínio e os casos de uso não sabem que o provedor mudou.
 */
export class SmtpEmailChannel implements MessageSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly options: SmtpEmailOptions) {
    this.transporter =
      options.transporter ??
      nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth: { user: options.user, pass: options.pass },
      });
    this.from = options.from;
  }

  async send(message: OutgoingMessage): Promise<Receipt> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.email ?? '',
      subject: message.subject ?? '',
      text: message.message,
    });
    return { providerId: info.messageId ?? `<${this.options.ids.newId()}@smtp>` };
  }
}

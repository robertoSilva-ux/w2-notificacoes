import 'dotenv/config';

export type Storage = 'prisma' | 'memory';
export type EmailProvider = 'log' | 'smtp';

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
}

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string | null;
  readonly smsFailureRate: number;
  readonly maxPerMinute: number;
  readonly storage: Storage;
  /** qual adaptador de e-mail usar: `log` (simulado) ou `smtp` (provedor real) */
  readonly emailProvider: EmailProvider;
  readonly smtp: SmtpConfig | null;
  readonly mailFrom: string;
}

/**
 * O ÚNICO lugar do sistema que lê `process.env` (critério "composition root único").
 * A escolha de implementação — banco, probabilidade de falha, limite — é decidida aqui
 * e passada adiante como valor, nunca consultada de novo lá dentro.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const storage: Storage = (env.APP_STORAGE ?? 'prisma').toLowerCase() === 'memory' ? 'memory' : 'prisma';
  const databaseUrl = env.DATABASE_URL ?? null;

  if (storage === 'prisma' && !databaseUrl) {
    throw new Error('DATABASE_URL não definida');
  }

  const emailProvider: EmailProvider = (env.EMAIL_PROVIDER ?? 'log').toLowerCase() === 'smtp' ? 'smtp' : 'log';

  return {
    port: env.PORT ? Number(env.PORT) : 3007,
    databaseUrl,
    smsFailureRate: env.SMS_FAILURE_RATE ? Number(env.SMS_FAILURE_RATE) : 0.2,
    maxPerMinute: env.MAX_NOTIFICATIONS_PER_MINUTE ? Number(env.MAX_NOTIFICATIONS_PER_MINUTE) : 5,
    storage,
    emailProvider,
    smtp: emailProvider === 'smtp' ? readSmtp(env) : null,
    mailFrom: env.MAIL_FROM ?? 'no-reply@notificacoes.local',
  };
}

function readSmtp(env: NodeJS.ProcessEnv): SmtpConfig {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('EMAIL_PROVIDER=smtp exige SMTP_HOST, SMTP_USER e SMTP_PASS');
  }
  return {
    host,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: env.SMTP_SECURE === 'true',
    user,
    pass,
  };
}

import type { NextFunction, Request, Response } from 'express';
import type { Notification } from '../../../domain/notification.js';
import { DeliveryFailed, DomainError } from '../../../domain/errors.js';
import { notificationJson } from './serializers.js';

/**
 * O único lugar que traduz erro de domínio em status HTTP (E6).
 * Nada de stack trace, mensagem do Prisma ou HTML: o cliente recebe sempre `{ error }`.
 */
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_CONTACT: 400,
  UNKNOWN_CHANNEL: 400,
  CONTACT_NOT_FOUND: 404,
  NOTIFICATION_NOT_FOUND: 404,
  ALREADY_SENT: 409,
  RETRY_LIMIT_REACHED: 409,
  CHANNEL_REJECTED: 422,
  RATE_LIMITED: 429,
};

function isBodyParseError(error: unknown): boolean {
  return error instanceof SyntaxError && 'body' in (error as object);
}

export function errorHandler(log: (error: unknown) => void = (e) => console.error(e)) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    // 502 devolve a notificação atualizada (contrato do reenvio)
    if (error instanceof DeliveryFailed) {
      res.status(502).json(notificationJson(error.notification as Notification));
      return;
    }
    if (error instanceof DomainError) {
      const status = STATUS_BY_CODE[error.code];
      if (status !== undefined) {
        res.status(status).json({ error: error.message });
        return;
      }
    }
    if (isBodyParseError(error)) {
      res.status(400).json({ error: 'corpo JSON inválido' });
      return;
    }
    log(error);
    res.status(500).json({ error: 'erro interno' });
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'rota não encontrada' });
}

/** Converte ":id" em número; devolve null quando não é um id válido. */
export function parseId(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

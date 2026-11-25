import { Router } from 'express';
import type { NotificationStatus } from '../../../domain/notification.js';
import type { ListDeliveredMessages } from '../../../application/use-cases/list-delivered-messages.js';
import type { GetNotification, ListNotifications } from '../../../application/use-cases/notifications.js';
import type { RetryNotification } from '../../../application/use-cases/retry-notification.js';
import type { SendNotifications } from '../../../application/use-cases/send-notifications.js';
import { parseId } from './error-handler.js';
import { deliveredMessageJson, embeddedContactJson, notificationJson } from './serializers.js';

export interface NotificationHttpDeps {
  sendNotifications: SendNotifications;
  retryNotification: RetryNotification;
  listNotifications: ListNotifications;
  getNotification: GetNotification;
  listDeliveredMessages: ListDeliveredMessages;
}

/**
 * Adaptador primário de /notifications e /fake-inbox.
 * Validação de *formato* da requisição mora aqui; validação de negócio mora no domínio.
 */
export function notificationsRouter(deps: NotificationHttpDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const contactId = toPositiveNumber(body.contactId);
    if (
      contactId === null ||
      !Array.isArray(body.channels) ||
      body.channels.length === 0 ||
      typeof body.message !== 'string' ||
      body.message.length === 0
    ) {
      res.status(400).json({ error: 'contactId, channels (lista) e message são obrigatórios' });
      return;
    }

    const notifications = await deps.sendNotifications.execute({
      contactId,
      channels: body.channels as string[],
      message: body.message,
      subject: typeof body.subject === 'string' ? body.subject : null,
    });
    res.status(201).json(notifications.map(notificationJson));
  });

  router.get('/', async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;

    let contactId: number | undefined;
    if (typeof req.query.contactId === 'string' && req.query.contactId !== '') {
      const parsed = toPositiveNumber(req.query.contactId);
      if (parsed === null) {
        res.status(400).json({ error: 'contactId inválido' });
        return;
      }
      contactId = parsed;
    }

    const notifications = await deps.listNotifications.execute({
      status: status as NotificationStatus | undefined,
      channel,
      contactId,
    });
    res.json(notifications.map(notificationJson));
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const { notification, contact } = await deps.getNotification.execute(id);
    res.json({ ...notificationJson(notification), contact: embeddedContactJson(contact) });
  });

  router.post('/:id/retry', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    res.json(notificationJson(await deps.retryNotification.execute(id)));
  });

  return router;
}

/** Adaptador primário da caixa de entrada do canal `fake`. */
export function fakeInboxRouter(deps: { listDeliveredMessages: ListDeliveredMessages }): Router {
  const router = Router();

  router.get('/:contactId', async (req, res) => {
    const contactId = toPositiveNumber(req.params.contactId);
    // o original filtrava por NaN e devolvia lista vazia: contrato preservado
    if (contactId === null) {
      res.json([]);
      return;
    }
    const messages = await deps.listDeliveredMessages.execute(contactId);
    res.json(messages.map(deliveredMessageJson));
  });

  return router;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

import express, { type Express } from 'express';
import { contactsRouter, type ContactHttpDeps } from './contacts-router.js';
import { fakeInboxRouter, notificationsRouter, type NotificationHttpDeps } from './notifications-router.js';
import { errorHandler, notFoundHandler } from './error-handler.js';

export interface HttpDeps extends ContactHttpDeps, NotificationHttpDeps {}

/**
 * Monta o adaptador primário HTTP a partir dos casos de uso já prontos.
 * Não instancia nada de infraestrutura: quem faz isso é o composition root.
 */
export function createApp(deps: HttpDeps, options: { log?: (error: unknown) => void } = {}): Express {
  const app = express();
  app.use(express.json());
  app.use('/contacts', contactsRouter(deps));
  app.use('/notifications', notificationsRouter(deps));
  app.use('/fake-inbox', fakeInboxRouter({ listDeliveredMessages: deps.listDeliveredMessages }));
  app.use(notFoundHandler);
  app.use(errorHandler(options.log));
  return app;
}

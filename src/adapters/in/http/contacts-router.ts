import { Router } from 'express';
import type { GetContact, ListContacts } from '../../../application/use-cases/contacts.js';
import type { CreateContact } from '../../../application/use-cases/create-contact.js';
import { contactJson } from './serializers.js';
import { parseId } from './error-handler.js';

export interface ContactHttpDeps {
  createContact: CreateContact;
  listContacts: ListContacts;
  getContact: GetContact;
}

/** Adaptador primário de /contacts: traduz HTTP ↔ caso de uso. Nenhuma regra de negócio aqui. */
export function contactsRouter(deps: ContactHttpDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const contact = await deps.createContact.execute(req.body ?? {});
    res.status(201).json(contactJson(contact));
  });

  router.get('/', async (_req, res) => {
    const contacts = await deps.listContacts.execute();
    res.json(contacts.map(contactJson));
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    res.json(contactJson(await deps.getContact.execute(id)));
  });

  return router;
}

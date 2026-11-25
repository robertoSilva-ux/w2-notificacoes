import type { Contact } from '../../domain/contact.js';
import { ContactNotFound } from '../../domain/errors.js';
import type { ContactRepository } from '../ports/contact-repository.js';

export class GetContact {
  constructor(private readonly contacts: ContactRepository) {}

  async execute(id: number): Promise<Contact> {
    const contact = await this.contacts.findById(id);
    if (!contact) throw new ContactNotFound();
    return contact;
  }
}

export class ListContacts {
  constructor(private readonly contacts: ContactRepository) {}

  async execute(): Promise<Contact[]> {
    return this.contacts.findAll();
  }
}

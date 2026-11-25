import type { ChannelCatalogue } from '../../domain/channel.js';
import { Contact, type NewContact } from '../../domain/contact.js';
import type { ContactRepository } from '../ports/contact-repository.js';

export class CreateContact {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly catalogue: ChannelCatalogue,
  ) {}

  async execute(input: NewContact): Promise<Contact> {
    return this.contacts.save(Contact.create(input, this.catalogue));
  }
}

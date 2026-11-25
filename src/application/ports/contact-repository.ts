import type { Contact } from '../../domain/contact.js';

/** Porta de persistência de contatos, na linguagem do domínio. */
export interface ContactRepository {
  save(contact: Contact): Promise<Contact>;
  findById(id: number): Promise<Contact | null>;
  findAll(): Promise<Contact[]>;
}

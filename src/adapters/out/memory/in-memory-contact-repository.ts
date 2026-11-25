import type { ContactRepository } from '../../../application/ports/contact-repository.js';
import type { Contact } from '../../../domain/contact.js';

/** Implementação em memória da porta de contatos (testes e boot sem banco). */
export class InMemoryContactRepository implements ContactRepository {
  private readonly rows: Contact[] = [];
  private sequence = 0;

  constructor(private readonly clock?: { now(): Date }) {}

  async save(contact: Contact): Promise<Contact> {
    if (contact.id === null) {
      const saved = contact.withId(++this.sequence, contact.createdAt ?? this.clock?.now() ?? new Date());
      this.rows.push(saved);
      return saved;
    }
    const index = this.rows.findIndex((c) => c.id === contact.id);
    if (index >= 0) this.rows[index] = contact;
    else this.rows.push(contact);
    return contact;
  }

  async findById(id: number): Promise<Contact | null> {
    return this.rows.find((c) => c.id === id) ?? null;
  }

  async findAll(): Promise<Contact[]> {
    return [...this.rows].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }
}

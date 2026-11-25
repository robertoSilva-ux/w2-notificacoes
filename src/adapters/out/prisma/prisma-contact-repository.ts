import type { PrismaClient } from '@prisma/client';
import type { ContactRepository } from '../../../application/ports/contact-repository.js';
import { Channel, type ChannelCatalogue } from '../../../domain/channel.js';
import { Contact } from '../../../domain/contact.js';

interface ContactRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  optOut: string;
  createdAt: Date;
}

/**
 * Adaptador de persistência de contatos.
 * Os detalhes de armazenamento — `optOut` como CSV, tipos do Prisma — morrem aqui:
 * nem o domínio nem os casos de uso sabem que existe um banco.
 */
export class PrismaContactRepository implements ContactRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogue: ChannelCatalogue,
  ) {}

  async save(contact: Contact): Promise<Contact> {
    const data = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      optOut: contact.optOut.map((c) => c.name).join(','),
    };

    if (contact.id === null) {
      const row = await this.prisma.contact.create({ data });
      return toDomain(row, this.catalogue);
    }
    const row = await this.prisma.contact.update({ where: { id: contact.id }, data });
    return toDomain(row, this.catalogue);
  }

  async findById(id: number): Promise<Contact | null> {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    return row ? toDomain(row, this.catalogue) : null;
  }

  async findAll(): Promise<Contact[]> {
    const rows = await this.prisma.contact.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => toDomain(row, this.catalogue));
  }
}

function toDomain(row: ContactRow, catalogue: ChannelCatalogue): Contact {
  return Contact.rehydrate({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    optOut: row.optOut
      ? row.optOut
          .split(',')
          .filter((name) => name.length > 0)
          .map((name) => Channel.from(name, catalogue))
      : [],
    createdAt: row.createdAt,
  });
}

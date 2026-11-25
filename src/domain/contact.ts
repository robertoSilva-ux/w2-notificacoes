import { Channel, type ChannelCatalogue } from './channel.js';
import { InvalidContact } from './errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+\d{10,15}$/;

export interface ContactProps {
  readonly id: number | null;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly optOut: Channel[];
  /** quando o contato foi persistido (o contrato da API devolve esse campo) */
  readonly createdAt: Date | null;
}

export interface NewContact {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  optOut?: unknown;
}

/**
 * Contato e as regras que o tornam válido (R1–R5).
 * Não conhece Express, Prisma, `optOut` como string CSV nem o formato de resposta:
 * isso é detalhe de adaptador.
 */
export class Contact {
  private constructor(private readonly props: ContactProps) {}

  /** @throws InvalidContact */
  static create(input: NewContact, catalogue: ChannelCatalogue): Contact {
    const { name, email, phone, optOut } = input;

    if (typeof name !== 'string' || name.trim().length < 2) {
      throw new InvalidContact('name é obrigatório (mínimo 2 caracteres)');
    }
    if (email != null && email !== '' && !(typeof email === 'string' && EMAIL.test(email))) {
      throw new InvalidContact('email inválido');
    }
    if (phone != null && phone !== '' && !(typeof phone === 'string' && PHONE.test(phone))) {
      throw new InvalidContact('phone deve estar no formato E.164 (ex.: +5511999998888)');
    }
    const hasEmail = typeof email === 'string' && email !== '';
    const hasPhone = typeof phone === 'string' && phone !== '';
    if (!hasEmail && !hasPhone) {
      throw new InvalidContact('informe ao menos email ou phone');
    }

    return new Contact({
      id: null,
      name: name.trim(),
      email: hasEmail ? (email as string) : null,
      phone: hasPhone ? (phone as string) : null,
      optOut: Contact.parseOptOut(optOut, catalogue),
      createdAt: null,
    });
  }

  /** Reconstitui um contato já persistido (sem revalidar). */
  static rehydrate(props: ContactProps): Contact {
    return new Contact({ ...props, optOut: [...props.optOut] });
  }

  private static parseOptOut(optOut: unknown, catalogue: ChannelCatalogue): Channel[] {
    if (optOut == null || optOut === '') return [];
    const known = catalogue.all().map((spec) => spec.name);
    if (!Array.isArray(optOut) || optOut.some((c) => typeof c !== 'string' || !known.includes(c))) {
      throw new InvalidContact(`optOut deve ser uma lista com: ${known.join(', ')}`);
    }
    return [...new Set(optOut as string[])].map((c) => Channel.from(c, catalogue));
  }

  get id(): number | null {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string | null {
    return this.props.email;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get optOut(): Channel[] {
    return [...this.props.optOut];
  }

  hasOptedOutOf(channel: Channel): boolean {
    return this.props.optOut.some((c) => c.equals(channel));
  }

  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  withId(id: number, createdAt: Date | null = this.props.createdAt): Contact {
    return new Contact({ ...this.props, id, createdAt });
  }
}

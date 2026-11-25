import { UnknownChannel } from './errors.js';

/**
 * Descrição de um canal: as regras que pertencem a ele.
 *
 * Um canal é *dado* (uma descrição), não um `if` no código. Por isso o catálogo é aberto:
 * acrescentar um canal novo é acrescentar uma descrição e um adaptador, sem alterar
 * `Channel`, `Contact`, `Notification`, `rejectionFor` nem os casos de uso (ADR-002).
 */
export interface ChannelSpec {
  readonly name: string;
  /** exige telefone do contato */
  readonly requiresPhone: boolean;
  /** exige e-mail do contato */
  readonly requiresEmail: boolean;
  /** exige assunto na mensagem */
  readonly requiresSubject: boolean;
  /** tamanho máximo da mensagem, quando o canal tem limite */
  readonly maxMessageLength: number | null;
}

/** Catálogo de canais conhecidos, montado fora do núcleo (composition root). */
export interface ChannelCatalogue {
  find(name: string): ChannelSpec | null;
  all(): readonly ChannelSpec[];
}

export class Channel {
  private constructor(private readonly spec: ChannelSpec) {}

  /** @throws UnknownChannel quando o nome não está no catálogo (R6) */
  static from(value: string, catalogue: ChannelCatalogue): Channel {
    const spec = catalogue.find(value);
    if (!spec) throw new UnknownChannel(value);
    return new Channel(spec);
  }

  static of(spec: ChannelSpec): Channel {
    return new Channel(spec);
  }

  get name(): string {
    return this.spec.name;
  }

  get requiresPhone(): boolean {
    return this.spec.requiresPhone;
  }

  get requiresEmail(): boolean {
    return this.spec.requiresEmail;
  }

  get requiresSubject(): boolean {
    return this.spec.requiresSubject;
  }

  get maxMessageLength(): number | null {
    return this.spec.maxMessageLength;
  }

  equals(other: Channel): boolean {
    return this.name === other.name;
  }

  toString(): string {
    return this.name;
  }
}

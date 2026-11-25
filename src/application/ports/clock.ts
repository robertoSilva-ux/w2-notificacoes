/** Relógio da aplicação: a regra não chama `Date.now()` diretamente (ADR-003). */
export interface Clock {
  now(): Date;
}

/** Gerador de identificadores usado pelos provedores (ADR-003). */
export interface IdGenerator {
  newId(): string;
}

/** Aleatoriedade como porta (ADR-003): a regra/canal não chama `Math.random()` direto. */
export interface Random {
  /** valor em [0, 1) */
  next(): number;
}

import crypto from 'node:crypto';
import type { Clock, IdGenerator } from '../../../application/ports/clock.js';
import type { Random } from '../../../application/ports/random.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class CryptoIds implements IdGenerator {
  newId(): string {
    return crypto.randomUUID();
  }
}

export class MathRandom implements Random {
  next(): number {
    return Math.random();
  }
}

/** Espera real; nos testes o adaptador recebe uma função de espera que não dorme. */
export const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

import { randomInt } from 'node:crypto';
import { ORDER_REFERENCE_ALPHABET, ORDER_REFERENCE_RANDOM_LENGTH } from '@painter/shared';

/**
 * Human-readable, non-sequential order reference, e.g. `ORD-2026-7K3QXM`.
 * Uses a cryptographically secure RNG and an alphabet without ambiguous characters.
 */
export function generateOrderReference(now: Date = new Date(), random: (max: number) => number = randomInt): string {
  let suffix = '';
  for (let i = 0; i < ORDER_REFERENCE_RANDOM_LENGTH; i++) {
    suffix += ORDER_REFERENCE_ALPHABET[random(ORDER_REFERENCE_ALPHABET.length)];
  }
  return `ORD-${now.getUTCFullYear()}-${suffix}`;
}

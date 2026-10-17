import { describe, expect, it } from 'vitest';
import { ORDER_REFERENCE_PATTERN } from '@painter/shared';
import { generateOrderReference } from './order-reference';

describe('generateOrderReference', () => {
  it('produces ORD-<year>-<6 unambiguous characters>', () => {
    const ref = generateOrderReference(new Date('2026-03-01T12:00:00Z'));
    expect(ref).toMatch(ORDER_REFERENCE_PATTERN);
    expect(ref.startsWith('ORD-2026-')).toBe(true);
  });

  it('never uses ambiguous characters and is not sequential', () => {
    const refs = new Set(Array.from({ length: 2000 }, () => generateOrderReference()));
    expect(refs.size).toBeGreaterThan(1990);
    for (const ref of refs) expect(ref.slice(9)).not.toMatch(/[01OIL]/);
  });
});

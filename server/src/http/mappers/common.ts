import type { Prisma } from '@prisma/client';

export const toNumber = (value: Prisma.Decimal): number => value.toNumber();
export const toNumberOrNull = (value: Prisma.Decimal | null): number | null => (value ? value.toNumber() : null);
export const toIso = (value: Date): string => value.toISOString();
export const toIsoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null);

/** `@db.Date` columns come back as UTC midnight. */
export const toDateOnlyOrNull = (value: Date | null): string | null => (value ? value.toISOString().slice(0, 10) : null);

export function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

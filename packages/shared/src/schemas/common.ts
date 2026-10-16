import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { LOCALES } from '../locales';

/** Trims strings and turns empty strings / null into `undefined`. */
export function emptyToUndefined(value: unknown): unknown {
  if (value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value;
}

/** Converts form values ('' / NaN / numeric strings) into numbers or `undefined`. */
export function toOptionalNumber(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}

export function requiredString(max = 200) {
  return z
    .string({ error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(max, 'validation.tooLong');
}

export function optionalString(max = 2000) {
  return z.preprocess(
    emptyToUndefined,
    z.string({ error: 'validation.invalid' }).max(max, 'validation.tooLong').optional(),
  );
}

export function requiredPositiveNumber(max = 1_000_000) {
  return z.preprocess(
    toOptionalNumber,
    z
      .number({ error: (issue) => (issue.input === undefined ? 'validation.required' : 'validation.number') })
      .positive('validation.positive')
      .max(max, 'validation.tooLarge'),
  );
}

export function optionalPositiveNumber(max = 1_000_000) {
  return z.preprocess(
    toOptionalNumber,
    z.number({ error: 'validation.number' }).positive('validation.positive').max(max, 'validation.tooLarge').optional(),
  );
}

export const emailSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .toLowerCase()
  .min(1, 'validation.required')
  .max(254, 'validation.tooLong')
  .pipe(z.email({ error: 'validation.email' }));

export const optionalEmailSchema = z.preprocess(emptyToUndefined, emailSchema.optional());

/** International phone number starting with a country code, e.g. `+32 470 12 34 56`. */
export const PHONE_PATTERN = /^\+[1-9]\d{0,3}[\d\s().-]{5,20}$/;
export const phoneSchema = requiredString(40).regex(PHONE_PATTERN, 'validation.phone');
export const optionalPhoneSchema = z.preprocess(
  emptyToUndefined,
  z.string().max(40, 'validation.tooLong').regex(PHONE_PATTERN, 'validation.phone').optional(),
);

export const localeSchema = z.enum(LOCALES, { error: 'validation.invalidOption' });

/** `YYYY-MM-DD` calendar date. */
export const isoDateSchema = z.iso.date({ error: 'validation.date' });

export const uuidSchema = z.uuid({ error: 'validation.invalid' });

export const idParamSchema = z.object({ id: uuidSchema });

/** Booleans from query strings ("true"/"false"/"1"/"0"). */
export const queryBooleanSchema = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean({ error: 'validation.invalid' }));

export const paginationQuerySchema = z.object({
  page: z.coerce.number({ error: 'validation.number' }).int('validation.integer').min(1).default(1),
  pageSize: z.coerce
    .number({ error: 'validation.number' })
    .int('validation.integer')
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const localeQuerySchema = z.object({
  locale: localeSchema.optional(),
});

/** Today's date as `YYYY-MM-DD` in the local time zone of the running process. */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Public image reference: absolute http(s) URL or a path served from the public media folder. */
export const IMAGE_URL_PATTERN = /^(https?:\/\/\S+|\/media\/[A-Za-z0-9/_.-]+)$/;
export const imageUrlSchema = requiredString(1000).regex(IMAGE_URL_PATTERN, 'validation.url');
export const optionalImageUrlSchema = z.preprocess(
  emptyToUndefined,
  z.string().max(1000, 'validation.tooLong').regex(IMAGE_URL_PATTERN, 'validation.url').optional(),
);

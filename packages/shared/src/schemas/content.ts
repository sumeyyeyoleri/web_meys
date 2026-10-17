import { z } from 'zod';
import { CONTENT_KEYS, DIMENSION_UNITS, HEX_COLOR_PATTERN, PORTFOLIO_CATEGORIES, SPACES } from '../constants';
import { DEFAULT_LOCALE, LOCALES } from '../locales';
import {
  emptyToUndefined,
  imageUrlSchema,
  localeSchema,
  optionalEmailSchema,
  optionalImageUrlSchema,
  optionalPositiveNumber,
  optionalString,
  requiredString,
  uuidSchema,
} from './common';

/** Builds `{ 'nl-BE': T, en: T, tr: T }` — every language must be present. */
function perLocale<T extends z.ZodType>(schema: T) {
  return z.object({ 'nl-BE': schema, en: schema, tr: schema });
}

/* ---------- Portfolio ---------- */

export const spaceSchema = z.enum(SPACES, { error: 'validation.invalidOption' });

export const portfolioTranslationSchema = z.object({
  title: requiredString(150),
  description: optionalString(2000),
});

export const portfolioItemSchema = z.object({
  imageUrl: imageUrlSchema,
  category: z.enum(PORTFOLIO_CATEGORIES, { error: 'validation.invalidOption' }),
  width: optionalPositiveNumber(100_000),
  height: optionalPositiveNumber(100_000),
  unit: z.preprocess(emptyToUndefined, z.enum(DIMENSION_UNITS, { error: 'validation.invalidOption' }).optional()),
  year: z.preprocess(
    (value) => (value === '' || value === null || Number.isNaN(value) ? undefined : value),
    z.coerce
      .number({ error: 'validation.number' })
      .int('validation.integer')
      .min(1900, 'validation.year')
      .max(2100, 'validation.year')
      .optional(),
  ),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  isSample: z.boolean(),
  spaces: z
    .array(spaceSchema)
    .max(SPACES.length)
    .default([])
    .transform((spaces) => SPACES.filter((space) => spaces.includes(space))),
  allowSimilarRequest: z.boolean().default(true),
  translations: perLocale(portfolioTranslationSchema),
});
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

/* ---------- Services ---------- */

export const serviceTranslationSchema = z.object({
  name: requiredString(120),
  description: optionalString(2000),
});

export const serviceSchema = z.object({
  imageUrl: optionalImageUrlSchema,
  isActive: z.boolean(),
  isWallService: z.boolean(),
  translations: perLocale(serviceTranslationSchema),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

/* ---------- Ordering (accessible move up / move down) ---------- */

export const reorderSchema = z.object({
  id: uuidSchema,
  direction: z.enum(['up', 'down'], { error: 'validation.invalidOption' }),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const toggleSchema = z.object({ value: z.boolean({ error: 'validation.invalid' }) });

/* ---------- Text blocks ---------- */

export const contentKeySchema = z.enum(CONTENT_KEYS, { error: 'validation.invalidOption' });

export const contentUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        key: contentKeySchema,
        locale: localeSchema,
        value: z.string({ error: 'validation.required' }).max(20_000, 'validation.tooLong'),
      }),
    )
    .min(1, 'validation.required'),
});
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;

/* ---------- Site settings ---------- */

export const siteSettingsSchema = z.object({
  businessName: requiredString(120),
  accentColor: requiredString(7).regex(HEX_COLOR_PATTERN, 'validation.color'),
  instagramUrl: z.preprocess(
    emptyToUndefined,
    z.url({ protocol: /^https?$/, error: 'validation.url' }).max(500, 'validation.tooLong').optional(),
  ),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalString(40),
  contactAddress: optionalString(300),
  enabledLocales: z
    .array(localeSchema)
    .refine((locales) => locales.includes(DEFAULT_LOCALE), 'validation.defaultLocaleRequired')
    .transform((locales) => LOCALES.filter((locale) => locales.includes(locale))),
  budgetRequired: z.boolean(),
  deadlineRequired: z.boolean(),
  emailNotificationsEnabled: z.boolean(),
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

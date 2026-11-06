import { z } from 'zod';
import { CONTENT_KEYS, DIMENSION_UNITS, HEX_COLOR_PATTERN } from '../constants';
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

export const portfolioTranslationSchema = z.object({
  title: requiredString(150),
  description: optionalString(2000),
});

export const portfolioItemSchema = z.object({
  imageUrl: imageUrlSchema,
  /** Empty or missing = uncategorised. */
  categoryId: z.preprocess(emptyToUndefined, uuidSchema.optional()).transform((value) => value ?? null),
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
  allowSimilarRequest: z.boolean().default(true),
  translations: perLocale(portfolioTranslationSchema),
});
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

/* ---------- Catalog categories ---------- */

export const categorySchema = z.object({
  translations: perLocale(z.object({ name: requiredString(60), description: optionalString(600) })),
  /** "Show on the site" (catalog filter, services page); off also hides its works. */
  isVisible: z.boolean().default(true),
  showInOrderForm: z.boolean().default(true),
  coverImageUrl: optionalImageUrlSchema,
  defaultUnit: z
    .preprocess(emptyToUndefined, z.enum(DIMENSION_UNITS, { error: 'validation.invalidOption' }).optional())
    .transform((value) => value ?? null),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** Deleting a category: its works move to `moveTo`, or become uncategorised when it is empty. */
export const deleteCategorySchema = z.object({
  moveTo: z.preprocess(emptyToUndefined, uuidSchema.optional()),
});
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

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
  emailNotificationsEnabled: z.boolean(),
  welcomeEnabled: z.boolean(),
  welcomeImageUrl: optionalImageUrlSchema,
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

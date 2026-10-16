/**
 * Single place that maps between the locale codes used by the web app / API (`nl-BE`)
 * and the Prisma enum values stored in the database (`NL_BE`).
 */
export const LOCALES = ['nl-BE', 'en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'nl-BE';

export const DB_LOCALES = ['NL_BE', 'EN', 'TR'] as const;
export type DbLocale = (typeof DB_LOCALES)[number];

const TO_DB: Record<Locale, DbLocale> = { 'nl-BE': 'NL_BE', en: 'EN', tr: 'TR' };
const FROM_DB: Record<DbLocale, Locale> = { NL_BE: 'nl-BE', EN: 'en', TR: 'tr' };

export function localeToDb(locale: Locale): DbLocale {
  return TO_DB[locale];
}

export function localeFromDb(locale: DbLocale): Locale {
  return FROM_DB[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

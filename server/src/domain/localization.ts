import type { Locale as DbLocale } from '@prisma/client';
import { localeToDb, type Locale } from '@painter/shared';

/** Picks the translation for `locale`, falling back to nl-BE, then to any available one. */
export function pickTranslation<T extends { locale: DbLocale }>(translations: readonly T[], locale: Locale): T | undefined {
  const wanted = localeToDb(locale);
  return (
    translations.find((t) => t.locale === wanted) ?? translations.find((t) => t.locale === 'NL_BE') ?? translations[0]
  );
}

import type { PortfolioCategory, Space } from '@prisma/client';
import { notFound } from '../domain/errors';
import { CONTENT_KEYS, DEFAULT_LOCALE, localeFromDb, localeToDb, type ContentKey, type Locale } from '@painter/shared';
import type { Repositories } from '../repositories';

export function createContentService({ repos }: { repos: Repositories }) {
  async function requireSettings() {
    const settings = await repos.content.getSettings();
    if (!settings) throw new Error('Site settings are missing — run the database seed.');
    return settings;
  }

  return {
    requireSettings,

    /** Falls back to nl-BE when a locale is disabled or not requested. */
    async resolveLocale(requested: Locale | undefined): Promise<Locale> {
      if (!requested) return DEFAULT_LOCALE;
      const settings = await requireSettings();
      return settings.enabledLocales.map(localeFromDb).includes(requested) ? requested : DEFAULT_LOCALE;
    },

    /** Text blocks in `locale`, with nl-BE as fallback for empty or missing blocks. */
    async getContent(locale: Locale): Promise<Partial<Record<ContentKey, string>>> {
      const rows = await repos.content.listContent([localeToDb(locale), localeToDb(DEFAULT_LOCALE)]);
      const result: Partial<Record<ContentKey, string>> = {};
      for (const key of CONTENT_KEYS) {
        const own = rows.find((r) => r.key === key && r.locale === localeToDb(locale))?.value;
        const fallback = rows.find((r) => r.key === key && r.locale === localeToDb(DEFAULT_LOCALE))?.value;
        const value = own?.trim() ? own : fallback;
        if (value !== undefined) result[key] = value;
      }
      return result;
    },

    listActiveServices() {
      return repos.content.listActiveServices();
    },

    listPortfolio(filter: { category?: PortfolioCategory; space?: Space; featured?: boolean }) {
      return repos.content.listPublishedPortfolio(filter);
    },

    async getPublishedPortfolioItem(id: string) {
      const item = await repos.content.findPortfolioItem(id);
      if (!item?.isPublished) throw notFound('Portfolio item not found');
      return item;
    },
  };
}

export type ContentService = ReturnType<typeof createContentService>;

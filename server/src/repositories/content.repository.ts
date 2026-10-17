import type { Locale, PortfolioCategory, Space } from '@prisma/client';
import type { Db } from './db';

export function createContentRepository(db: Db) {
  return {
    getSettings() {
      return db.siteSettings.findUnique({ where: { id: 1 } });
    },

    listContent(locales: Locale[]) {
      return db.localizedContent.findMany({ where: { locale: { in: locales } } });
    },

    findService(id: string) {
      return db.service.findUnique({ where: { id }, include: { translations: true } });
    },

    listActiveServices() {
      return db.service.findMany({
        where: { isActive: true },
        include: { translations: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    },

    findPortfolioItem(id: string) {
      return db.portfolioItem.findUnique({ where: { id }, include: { translations: true } });
    },

    listPublishedPortfolio(filter: { category?: PortfolioCategory; space?: Space; featured?: boolean }) {
      return db.portfolioItem.findMany({
        where: {
          isPublished: true,
          ...(filter.category ? { category: filter.category } : {}),
          ...(filter.space ? { spaces: { has: filter.space } } : {}),
          ...(filter.featured !== undefined ? { isFeatured: filter.featured } : {}),
        },
        include: { translations: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;

import type { Locale, Prisma } from '@prisma/client';
import { onSiteWhere } from '../domain/catalog';
import type { Db } from './db';

const portfolioInclude = { translations: true, category: { include: { translations: true } } } as const;
export type PublicPortfolioItem = Prisma.PortfolioItemGetPayload<{ include: typeof portfolioInclude }>;

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
      return db.portfolioItem.findUnique({ where: { id }, include: portfolioInclude });
    },

    /** Works on the site, optionally of one category (by its URL slug). */
    listPublishedPortfolio(filter: { category?: string; featured?: boolean }) {
      return db.portfolioItem.findMany({
        where: {
          ...onSiteWhere,
          ...(filter.category ? { category: { slug: filter.category, isVisible: true } } : {}),
          ...(filter.featured !== undefined ? { isFeatured: filter.featured } : {}),
        },
        include: portfolioInclude,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    },

    /** Visible categories that have at least one published work (the catalog filters). */
    listCategoriesWithWorks() {
      return db.category.findMany({
        where: { isVisible: true, items: { some: { isPublished: true } } },
        include: { translations: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;

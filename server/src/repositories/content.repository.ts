import type { Locale, Prisma } from '@prisma/client';
import { onSiteWhere } from '../domain/catalog';
import type { Db } from './db';

const portfolioInclude = { translations: true, category: { include: { translations: true } } } as const;
export type PublicPortfolioItem = Prisma.PortfolioItemGetPayload<{ include: typeof portfolioInclude }>;
export type SiteCategory = Awaited<ReturnType<ContentRepository['listSiteCategories']>>[number];

export function createContentRepository(db: Db) {
  return {
    getSettings() {
      return db.siteSettings.findUnique({ where: { id: 1 } });
    },

    listContent(locales: Locale[]) {
      return db.localizedContent.findMany({ where: { locale: { in: locales } } });
    },

    findCategory(id: string) {
      return db.category.findUnique({ where: { id }, include: { translations: true } });
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

    /** Categories shown on the site or in the order form, with their number of published works. */
    listSiteCategories() {
      return db.category.findMany({
        where: { OR: [{ isVisible: true }, { showInOrderForm: true }] },
        include: { translations: true, _count: { select: { items: { where: { isPublished: true } } } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;

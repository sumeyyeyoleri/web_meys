import type { Locale, Prisma } from '@prisma/client';
import type { Db } from './db';

type TranslationRow<T> = { locale: Locale } & T;

const portfolioInclude = { translations: true } as const;
const serviceInclude = { translations: true, _count: { select: { orders: true } } } as const;

export type AdminServiceWithCount = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;
export type PortfolioWithTranslations = Prisma.PortfolioItemGetPayload<{ include: typeof portfolioInclude }>;

/** Rewrites sortOrder as 0..n-1 after moving `id` one place up or down. */
function reorderIds(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function createAdminContentRepository(db: Db) {
  return {
    /* ---------- Portfolio ---------- */

    listPortfolio() {
      return db.portfolioItem.findMany({ include: portfolioInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    },

    findPortfolio(id: string) {
      return db.portfolioItem.findUnique({ where: { id }, include: portfolioInclude });
    },

    async nextPortfolioSortOrder(): Promise<number> {
      const result = await db.portfolioItem.aggregate({ _max: { sortOrder: true } });
      return (result._max.sortOrder ?? -1) + 1;
    },

    createPortfolio(
      data: Omit<Prisma.PortfolioItemCreateInput, 'translations'>,
      translations: TranslationRow<{ title: string; description: string | null }>[],
    ) {
      return db.portfolioItem.create({
        data: { ...data, translations: { create: translations } },
        include: portfolioInclude,
      });
    },

    async updatePortfolio(
      id: string,
      data: Prisma.PortfolioItemUpdateInput,
      translations: TranslationRow<{ title: string; description: string | null }>[],
    ) {
      await db.portfolioItem.update({ where: { id }, data });
      for (const t of translations) {
        await db.portfolioItemTranslation.upsert({
          where: { portfolioItemId_locale: { portfolioItemId: id, locale: t.locale } },
          create: { portfolioItemId: id, ...t },
          update: { title: t.title, description: t.description },
        });
      }
      return db.portfolioItem.findUniqueOrThrow({ where: { id }, include: portfolioInclude });
    },

    setPortfolioFeatured(id: string, isFeatured: boolean) {
      return db.portfolioItem.update({ where: { id }, data: { isFeatured }, include: portfolioInclude });
    },

    deletePortfolio(id: string) {
      return db.portfolioItem.delete({ where: { id } });
    },

    async movePortfolio(id: string, direction: 'up' | 'down'): Promise<boolean> {
      const rows = await db.portfolioItem.findMany({ select: { id: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      const ids = reorderIds(rows.map((r) => r.id), id, direction);
      if (!ids) return false;
      for (const [sortOrder, itemId] of ids.entries()) {
        await db.portfolioItem.update({ where: { id: itemId }, data: { sortOrder } });
      }
      return true;
    },

    /* ---------- Services ---------- */

    listServices() {
      return db.service.findMany({ include: serviceInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    },

    findService(id: string) {
      return db.service.findUnique({ where: { id }, include: serviceInclude });
    },

    async nextServiceSortOrder(): Promise<number> {
      const result = await db.service.aggregate({ _max: { sortOrder: true } });
      return (result._max.sortOrder ?? -1) + 1;
    },

    createService(
      data: Omit<Prisma.ServiceCreateInput, 'translations'>,
      translations: TranslationRow<{ name: string; description: string | null }>[],
    ) {
      return db.service.create({ data: { ...data, translations: { create: translations } }, include: serviceInclude });
    },

    async updateService(
      id: string,
      data: Prisma.ServiceUpdateInput,
      translations: TranslationRow<{ name: string; description: string | null }>[],
    ) {
      await db.service.update({ where: { id }, data });
      for (const t of translations) {
        await db.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: id, locale: t.locale } },
          create: { serviceId: id, ...t },
          update: { name: t.name, description: t.description },
        });
      }
      return db.service.findUniqueOrThrow({ where: { id }, include: serviceInclude });
    },

    setServiceActive(id: string, isActive: boolean) {
      return db.service.update({ where: { id }, data: { isActive }, include: serviceInclude });
    },

    deleteService(id: string) {
      return db.service.delete({ where: { id } });
    },

    async moveService(id: string, direction: 'up' | 'down'): Promise<boolean> {
      const rows = await db.service.findMany({ select: { id: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      const ids = reorderIds(rows.map((r) => r.id), id, direction);
      if (!ids) return false;
      for (const [sortOrder, serviceId] of ids.entries()) {
        await db.service.update({ where: { id: serviceId }, data: { sortOrder } });
      }
      return true;
    },

    /** Number of portfolio items and services still pointing at an image URL. */
    async countImageReferences(imageUrl: string): Promise<number> {
      const [portfolio, services] = await Promise.all([
        db.portfolioItem.count({ where: { imageUrl } }),
        db.service.count({ where: { imageUrl } }),
      ]);
      return portfolio + services;
    },

    /* ---------- Text blocks & settings ---------- */

    listAllContent() {
      return db.localizedContent.findMany();
    },

    upsertContent(key: string, locale: Locale, value: string) {
      return db.localizedContent.upsert({
        where: { key_locale: { key, locale } },
        create: { key, locale, value },
        update: { value },
      });
    },

    updateSettings(data: Prisma.SiteSettingsUpdateInput) {
      return db.siteSettings.update({ where: { id: 1 }, data });
    },
  };
}

export type AdminContentRepository = ReturnType<typeof createAdminContentRepository>;

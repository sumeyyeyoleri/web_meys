import type { Locale, Prisma } from '@prisma/client';
import type { Db } from './db';

type TranslationRow<T> = { locale: Locale } & T;

const portfolioInclude = { translations: true, category: { select: { isVisible: true } } } as const;
const categoryInclude = { translations: true, _count: { select: { items: true, orders: true } } } as const;

export type AdminCategoryWithCount = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

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

    categoryExists(id: string) {
      return db.category.count({ where: { id } }).then((count) => count > 0);
    },

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

    setPortfolioPublished(id: string, isPublished: boolean) {
      return db.portfolioItem.update({ where: { id }, data: { isPublished }, include: portfolioInclude });
    },

    /* ---------- Catalog categories ---------- */

    listCategories() {
      return db.category.findMany({ include: categoryInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    },

    findCategory(id: string) {
      return db.category.findUnique({ where: { id }, include: categoryInclude });
    },

    slugTaken(slug: string) {
      return db.category.count({ where: { slug } }).then((count) => count > 0);
    },

    async nextCategorySortOrder(): Promise<number> {
      const result = await db.category.aggregate({ _max: { sortOrder: true } });
      return (result._max.sortOrder ?? -1) + 1;
    },

    createCategory(data: Omit<Prisma.CategoryCreateInput, 'translations'>, translations: TranslationRow<{ name: string; description: string | null }>[]) {
      return db.category.create({ data: { ...data, translations: { create: translations } }, include: categoryInclude });
    },

    async updateCategory(id: string, data: Prisma.CategoryUpdateInput, translations: TranslationRow<{ name: string; description: string | null }>[]) {
      await db.category.update({ where: { id }, data });
      for (const t of translations) {
        await db.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale: t.locale } },
          create: { categoryId: id, ...t },
          update: { name: t.name, description: t.description },
        });
      }
      return db.category.findUniqueOrThrow({ where: { id }, include: categoryInclude });
    },

    setCategoryVisible(id: string, isVisible: boolean) {
      return db.category.update({ where: { id }, data: { isVisible }, include: categoryInclude });
    },

    /** Moves the works to `moveTo` (or leaves them uncategorised), then deletes the category. */
    async deleteCategory(id: string, moveTo: string | null) {
      await db.portfolioItem.updateMany({ where: { categoryId: id }, data: { categoryId: moveTo } });
      await db.category.delete({ where: { id } });
    },

    async moveCategory(id: string, direction: 'up' | 'down'): Promise<boolean> {
      const rows = await db.category.findMany({ select: { id: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      const ids = reorderIds(rows.map((r) => r.id), id, direction);
      if (!ids) return false;
      for (const [sortOrder, categoryId] of ids.entries()) {
        await db.category.update({ where: { id: categoryId }, data: { sortOrder } });
      }
      return true;
    },

    /** Number of works, category covers, (legacy) services and settings still pointing at an image URL. */
    async countImageReferences(imageUrl: string): Promise<number> {
      const counts = await Promise.all([
        db.portfolioItem.count({ where: { imageUrl } }),
        db.category.count({ where: { coverImageUrl: imageUrl } }),
        db.service.count({ where: { imageUrl } }),
        db.siteSettings.count({ where: { OR: [{ logoUrl: imageUrl }, { welcomeImageUrl: imageUrl }] } }),
      ]);
      return counts.reduce((sum, n) => sum + n, 0);
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

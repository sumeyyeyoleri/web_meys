import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  CONTENT_KEYS,
  LOCALES,
  localeFromDb,
  localeToDb,
  type ContentKey,
  type ContentUpdateInput,
  type Locale,
  type CategoryInput,
  type PortfolioItemInput,
  type SiteSettingsInput,
} from '@painter/shared';
import { AppError, notFound } from '../domain/errors';
import { setupChecklist } from '../domain/setup-checklist';
import { optimizeImage } from '../infrastructure/image-optimizer';
import { describeError, logger } from '../infrastructure/logger';
import type { StorageDriver } from '../infrastructure/storage';
import type { Repositories, TransactionRunner } from '../repositories';
import { validateImages, validateLogo, type IncomingFile } from './upload-validation';

/** Admin uploads live under this prefix; only these files are ever deleted automatically. */
const UPLOAD_PREFIX = 'uploads';

const dec = (value: number | undefined) => (value === undefined ? null : new Prisma.Decimal(value));

function slugify(text: string): string {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'item'}-${randomBytes(3).toString('hex')}`;
}

/** Readable URL value from a name, e.g. "Cafés & restaurants" → "cafes-restaurants". */
function slugBase(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'category'
  );
}

function translationRows<T>(translations: Record<Locale, T>) {
  return LOCALES.map((locale) => ({ locale: localeToDb(locale), ...translations[locale] }));
}

interface Deps {
  repos: Repositories;
  transaction: TransactionRunner;
  storage: StorageDriver;
  smtpConfigured: boolean;
}

export function createAdminContentService({ repos, transaction, storage, smtpConfigured }: Deps) {
  /** Deletes an admin-uploaded image once nothing references it any more. */
  async function releaseImage(url: string | null | undefined) {
    if (!url) return;
    const key = storage.publicKeyFromUrl(url);
    if (!key?.startsWith(`${UPLOAD_PREFIX}/`)) return;
    if ((await repos.adminContent.countImageReferences(url)) > 0) return;
    await storage.deletePublic(key).catch((error: unknown) => logger.warn('Failed to delete media', describeError(error)));
  }

  /** Every key × locale, with '' for blocks that were never filled in. */
  async function listContent(): Promise<Array<{ key: ContentKey; locale: Locale; value: string }>> {
    const rows = await repos.adminContent.listAllContent();
    return CONTENT_KEYS.flatMap((key) =>
      LOCALES.map((locale) => ({
        key,
        locale,
        value: rows.find((r) => r.key === key && localeFromDb(r.locale) === locale)?.value ?? '',
      })),
    );
  }

  async function getSettings() {
    const settings = await repos.content.getSettings();
    if (!settings) throw new Error('Site settings are missing — run the database seed.');
    return { settings, smtpConfigured };
  }

  async function requirePortfolio(id: string) {
    const item = await repos.adminContent.findPortfolio(id);
    if (!item) throw notFound('Portfolio item not found');
    return item;
  }

  /** A work's category must exist (empty = uncategorised). */
  async function checkCategory(input: PortfolioItemInput) {
    if (input.categoryId && !(await repos.adminContent.categoryExists(input.categoryId))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Unknown category', { categoryId: 'validation.invalidOption' });
    }
  }

  async function requireCategory(id: string) {
    const category = await repos.adminContent.findCategory(id);
    if (!category) throw notFound('Category not found');
    return category;
  }

  const categoryData = (input: CategoryInput) => ({
    isVisible: input.isVisible,
    showInOrderForm: input.showInOrderForm,
    coverImageUrl: input.coverImageUrl ?? null,
    defaultUnit: input.defaultUnit,
  });

  const categoryTranslations = (input: CategoryInput) =>
    translationRows(input.translations).map((t) => ({ locale: t.locale, name: t.name, description: t.description ?? null }));

  const portfolioData = (input: PortfolioItemInput) => ({
    imageUrl: input.imageUrl,
    width: dec(input.width),
    height: dec(input.height),
    unit: input.unit ?? null,
    year: input.year ?? null,
    isFeatured: input.isFeatured,
    isPublished: input.isPublished,
    isSample: input.isSample,
    allowSimilarRequest: input.allowSimilarRequest,
  });

  const portfolioTranslations = (input: PortfolioItemInput) =>
    translationRows(input.translations).map((t) => ({ locale: t.locale, title: t.title, description: t.description ?? null }));

  return {
    /* ---------- Portfolio ---------- */

    listPortfolio() {
      return repos.adminContent.listPortfolio();
    },

    async createPortfolio(input: PortfolioItemInput) {
      await checkCategory(input);
      return transaction(async (tx) =>
        tx.adminContent.createPortfolio(
          {
            ...portfolioData(input),
            ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
            slug: slugify(input.translations.en.title),
            sortOrder: await tx.adminContent.nextPortfolioSortOrder(),
          },
          portfolioTranslations(input),
        ),
      );
    },

    async updatePortfolio(id: string, input: PortfolioItemInput) {
      const existing = await requirePortfolio(id);
      await checkCategory(input);
      const updated = await transaction((tx) =>
        tx.adminContent.updatePortfolio(
          id,
          { ...portfolioData(input), category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true } },
          portfolioTranslations(input),
        ),
      );
      if (existing.imageUrl !== updated.imageUrl) await releaseImage(existing.imageUrl);
      return updated;
    },

    async setPortfolioFeatured(id: string, isFeatured: boolean) {
      await requirePortfolio(id);
      return repos.adminContent.setPortfolioFeatured(id, isFeatured);
    },

    async deletePortfolio(id: string) {
      const existing = await requirePortfolio(id);
      await repos.adminContent.deletePortfolio(id);
      await releaseImage(existing.imageUrl);
    },

    async movePortfolio(id: string, direction: 'up' | 'down') {
      const moved = await transaction((tx) => tx.adminContent.movePortfolio(id, direction));
      if (!moved) throw notFound('Portfolio item not found');
      return repos.adminContent.listPortfolio();
    },

    async setPortfolioPublished(id: string, isPublished: boolean) {
      await requirePortfolio(id);
      return repos.adminContent.setPortfolioPublished(id, isPublished);
    },

    /** "Hide all sample works": unpublishes them (they stay in the catalog list as drafts). */
    hideSamples() {
      return repos.adminContent.unpublishSamples();
    },

    async setupChecklist() {
      const [{ settings }, content, works] = await Promise.all([
        getSettings(),
        repos.adminContent.listAllContent(),
        repos.adminContent.countWorksForSetup(),
      ]);
      return setupChecklist({ settings, content, ...works });
    },

    /* ---------- Catalog categories ---------- */

    listCategories() {
      return repos.adminContent.listCategories();
    },

    /** The URL slug comes from the English name (then Dutch) and never changes afterwards, so links keep working. */
    async createCategory(input: CategoryInput) {
      const base = slugBase(input.translations.en.name || input.translations['nl-BE'].name);
      let slug = base;
      for (let n = 2; await repos.adminContent.slugTaken(slug); n += 1) slug = `${base}-${n}`;
      return transaction(async (tx) =>
        tx.adminContent.createCategory(
          { ...categoryData(input), slug, sortOrder: await tx.adminContent.nextCategorySortOrder() },
          categoryTranslations(input),
        ),
      );
    },

    async updateCategory(id: string, input: CategoryInput) {
      const existing = await requireCategory(id);
      const updated = await transaction((tx) => tx.adminContent.updateCategory(id, categoryData(input), categoryTranslations(input)));
      if (existing.coverImageUrl !== updated.coverImageUrl) await releaseImage(existing.coverImageUrl);
      return updated;
    },

    async setCategoryVisible(id: string, isVisible: boolean) {
      await requireCategory(id);
      return repos.adminContent.setCategoryVisible(id, isVisible);
    },

    /**
     * Works are never deleted with their category: they move to `moveTo` or become uncategorised.
     * Orders lose the link but keep the category's name (`serviceLabel`).
     */
    async deleteCategory(id: string, moveTo: string | undefined) {
      const existing = await requireCategory(id);
      if (moveTo !== undefined && (moveTo === id || !(await repos.adminContent.findCategory(moveTo)))) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Unknown target category', { moveTo: 'validation.invalidOption' });
      }
      await transaction((tx) => tx.adminContent.deleteCategory(id, moveTo ?? null));
      await releaseImage(existing.coverImageUrl);
    },

    async moveCategory(id: string, direction: 'up' | 'down') {
      const moved = await transaction((tx) => tx.adminContent.moveCategory(id, direction));
      if (!moved) throw notFound('Category not found');
      return repos.adminContent.listCategories();
    },

    /* ---------- Text blocks ---------- */

    listContent,

    async updateContent(input: ContentUpdateInput) {
      await transaction(async (tx) => {
        for (const item of input.items) {
          await tx.adminContent.upsertContent(item.key, localeToDb(item.locale), item.value);
        }
      });
      return listContent();
    },

    /* ---------- Settings ---------- */

    getSettings,

    async updateSettings(input: SiteSettingsInput) {
      const { settings: existing } = await getSettings();
      const settings = await repos.adminContent.updateSettings({
        businessName: input.businessName,
        accentColor: input.accentColor.toUpperCase(),
        instagramUrl: input.instagramUrl ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        contactAddress: input.contactAddress ?? null,
        enabledLocales: input.enabledLocales.map(localeToDb),
        emailNotificationsEnabled: input.emailNotificationsEnabled,
        welcomeEnabled: input.welcomeEnabled,
        welcomeImageUrl: input.welcomeImageUrl ?? null,
      });
      if (existing.welcomeImageUrl !== settings.welcomeImageUrl) await releaseImage(existing.welcomeImageUrl);
      return { settings, smtpConfigured };
    },

    /** Validates (SVG safety check or magic bytes) and stores the logo, replacing the previous one. */
    async uploadLogo(file: IncomingFile | undefined) {
      if (!file) {
        throw new AppError(400, 'VALIDATION_ERROR', 'A logo file is required', { file: 'validation.required' });
      }
      const logo = validateLogo(file, `${UPLOAD_PREFIX}/logo`);
      const { settings: existing } = await getSettings();
      const logoUrl = await storage.putPublic(logo.storageKey, logo.buffer, logo.mimeType);
      const settings = await repos.adminContent.updateSettings({ logoUrl });
      await releaseImage(existing.logoUrl);
      return { settings, smtpConfigured };
    },

    /** Back to the wordmark. */
    async removeLogo() {
      const { settings: existing } = await getSettings();
      const settings = await repos.adminContent.updateSettings({ logoUrl: null });
      await releaseImage(existing.logoUrl);
      return { settings, smtpConfigured };
    },

    /* ---------- Media ---------- */

    /** Validates (incl. magic bytes), optimises for the web (WebP, at most 2400 px) and stores a public image. */
    async uploadImage(file: IncomingFile | undefined): Promise<string> {
      if (!file) {
        throw new AppError(400, 'VALIDATION_ERROR', 'An image file is required', { file: 'validation.required' });
      }
      let image;
      try {
        [image] = validateImages([file], UPLOAD_PREFIX);
      } catch (error) {
        // Single-file endpoint: report errors on `file` instead of `files.0`.
        if (error instanceof AppError && error.fields) {
          throw new AppError(error.status, error.code, error.message, { file: Object.values(error.fields)[0] ?? 'validation.invalid' });
        }
        throw error;
      }
      if (!image) throw new Error('Image validation returned no result');
      const optimized = await optimizeImage(image.buffer);
      if (!optimized) {
        throw new AppError(400, 'UPLOAD_INVALID_TYPE', 'The image could not be read', { file: 'validation.fileUnreadable' });
      }
      return storage.putPublic(`${UPLOAD_PREFIX}/${randomUUID()}.webp`, optimized.buffer, optimized.mimeType);
    },
  };
}

export type AdminContentService = ReturnType<typeof createAdminContentService>;

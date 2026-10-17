import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  CONTENT_KEYS,
  LOCALES,
  localeFromDb,
  localeToDb,
  type ContentKey,
  type ContentUpdateInput,
  type Locale,
  type PortfolioItemInput,
  type ServiceInput,
  type SiteSettingsInput,
} from '@painter/shared';
import { AppError, notFound } from '../domain/errors';
import { describeError, logger } from '../infrastructure/logger';
import type { StorageDriver } from '../infrastructure/storage';
import type { Repositories, TransactionRunner } from '../repositories';
import { validateImages, type IncomingFile } from './upload-validation';

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

  async function requirePortfolio(id: string) {
    const item = await repos.adminContent.findPortfolio(id);
    if (!item) throw notFound('Portfolio item not found');
    return item;
  }

  async function requireService(id: string) {
    const service = await repos.adminContent.findService(id);
    if (!service) throw notFound('Service not found');
    return service;
  }

  const portfolioData = (input: PortfolioItemInput) => ({
    imageUrl: input.imageUrl,
    category: input.category,
    width: dec(input.width),
    height: dec(input.height),
    unit: input.unit ?? null,
    year: input.year ?? null,
    isFeatured: input.isFeatured,
    isPublished: input.isPublished,
    isSample: input.isSample,
    spaces: input.spaces,
    allowSimilarRequest: input.allowSimilarRequest,
  });

  const portfolioTranslations = (input: PortfolioItemInput) =>
    translationRows(input.translations).map((t) => ({ locale: t.locale, title: t.title, description: t.description ?? null }));

  const serviceTranslations = (input: ServiceInput) =>
    translationRows(input.translations).map((t) => ({ locale: t.locale, name: t.name, description: t.description ?? null }));

  return {
    /* ---------- Portfolio ---------- */

    listPortfolio() {
      return repos.adminContent.listPortfolio();
    },

    async createPortfolio(input: PortfolioItemInput) {
      return transaction(async (tx) =>
        tx.adminContent.createPortfolio(
          {
            ...portfolioData(input),
            slug: slugify(input.translations.en.title),
            sortOrder: await tx.adminContent.nextPortfolioSortOrder(),
          },
          portfolioTranslations(input),
        ),
      );
    },

    async updatePortfolio(id: string, input: PortfolioItemInput) {
      const existing = await requirePortfolio(id);
      const updated = await transaction((tx) =>
        tx.adminContent.updatePortfolio(id, portfolioData(input), portfolioTranslations(input)),
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

    /* ---------- Services ---------- */

    listServices() {
      return repos.adminContent.listServices();
    },

    async createService(input: ServiceInput) {
      return transaction(async (tx) =>
        tx.adminContent.createService(
          {
            slug: slugify(input.translations.en.name),
            imageUrl: input.imageUrl ?? null,
            isActive: input.isActive,
            isWallService: input.isWallService,
            sortOrder: await tx.adminContent.nextServiceSortOrder(),
          },
          serviceTranslations(input),
        ),
      );
    },

    async updateService(id: string, input: ServiceInput) {
      const existing = await requireService(id);
      const updated = await transaction((tx) =>
        tx.adminContent.updateService(
          id,
          { imageUrl: input.imageUrl ?? null, isActive: input.isActive, isWallService: input.isWallService },
          serviceTranslations(input),
        ),
      );
      if (existing.imageUrl !== updated.imageUrl) await releaseImage(existing.imageUrl);
      return updated;
    },

    async setServiceActive(id: string, isActive: boolean) {
      await requireService(id);
      return repos.adminContent.setServiceActive(id, isActive);
    },

    /** Services referenced by orders cannot be deleted (deactivate them instead). */
    async deleteService(id: string) {
      const existing = await requireService(id);
      if (existing._count.orders > 0) {
        throw new AppError(409, 'SERVICE_IN_USE', 'This service is used by orders. Deactivate it instead.');
      }
      await repos.adminContent.deleteService(id);
      await releaseImage(existing.imageUrl);
    },

    async moveService(id: string, direction: 'up' | 'down') {
      const moved = await transaction((tx) => tx.adminContent.moveService(id, direction));
      if (!moved) throw notFound('Service not found');
      return repos.adminContent.listServices();
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

    async getSettings() {
      const settings = await repos.content.getSettings();
      if (!settings) throw new Error('Site settings are missing — run the database seed.');
      return { settings, smtpConfigured };
    },

    async updateSettings(input: SiteSettingsInput) {
      const settings = await repos.adminContent.updateSettings({
        businessName: input.businessName,
        accentColor: input.accentColor.toUpperCase(),
        instagramUrl: input.instagramUrl ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        contactAddress: input.contactAddress ?? null,
        enabledLocales: input.enabledLocales.map(localeToDb),
        budgetRequired: input.budgetRequired,
        deadlineRequired: input.deadlineRequired,
        emailNotificationsEnabled: input.emailNotificationsEnabled,
      });
      return { settings, smtpConfigured };
    },

    /* ---------- Media ---------- */

    /** Validates (incl. magic bytes) and stores a public portfolio/service image. */
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
      return storage.putPublic(image.storageKey, image.buffer, image.mimeType);
    },
  };
}

export type AdminContentService = ReturnType<typeof createAdminContentService>;

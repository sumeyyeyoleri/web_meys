import type { Category, CategoryTranslation, SiteSettings } from '@prisma/client';
import { localeFromDb, type CategoryDto, type CategoryRefDto, type Locale, type PortfolioItemDto, type PublicSettingsDto } from '@painter/shared';
import type { PublicPortfolioItem, SiteCategory } from '../../repositories/content.repository';
import { pickTranslation } from '../../domain/localization';
import { toNumberOrNull } from './common';

/** What the server can do with its configuration (SMTP, DeepL). */
export interface SiteFeatures {
  emailAvailable: boolean;
  translationAvailable: boolean;
}

export function toPublicSettingsDto(settings: SiteSettings, { emailAvailable, translationAvailable }: SiteFeatures): PublicSettingsDto {
  return {
    businessName: settings.businessName,
    logoUrl: settings.logoUrl,
    accentColor: settings.accentColor,
    instagramUrl: settings.instagramUrl,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    contactAddress: settings.contactAddress,
    enabledLocales: settings.enabledLocales.map(localeFromDb),
    emailAvailable,
    translationAvailable,
    welcomeEnabled: settings.welcomeEnabled,
    welcomeImageUrl: settings.welcomeImageUrl,
  };
}

export function toCategoryRefDto(category: Category & { translations: CategoryTranslation[] }, locale: Locale): CategoryRefDto {
  return { id: category.id, slug: category.slug, name: pickTranslation(category.translations, locale)?.name ?? '' };
}

export function toCategoryDto(category: SiteCategory, locale: Locale): CategoryDto {
  const t = pickTranslation(category.translations, locale);
  return {
    ...toCategoryRefDto(category, locale),
    description: t?.description ?? null,
    coverImageUrl: category.coverImageUrl,
    defaultUnit: category.defaultUnit,
    showOnSite: category.isVisible,
    showInOrderForm: category.showInOrderForm,
    // A hidden category's works are not on the site.
    hasWorks: category.isVisible && category._count.items > 0,
  };
}

export function toPortfolioItemDto(item: PublicPortfolioItem, locale: Locale): PortfolioItemDto {
  const t = pickTranslation(item.translations, locale);
  return {
    id: item.id,
    title: t?.title ?? '',
    description: t?.description ?? null,
    category: item.category ? toCategoryRefDto(item.category, locale) : null,
    imageUrl: item.imageUrl,
    width: toNumberOrNull(item.width),
    height: toNumberOrNull(item.height),
    unit: item.unit,
    year: item.year,
    isFeatured: item.isFeatured,
    isSample: item.isSample,
    allowSimilarRequest: item.allowSimilarRequest,
  };
}

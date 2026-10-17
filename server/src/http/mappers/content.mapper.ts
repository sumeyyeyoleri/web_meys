import type { PortfolioItem, PortfolioItemTranslation, Service, ServiceTranslation, SiteSettings } from '@prisma/client';
import { localeFromDb, type Locale, type PortfolioItemDto, type PublicSettingsDto, type ServiceDto } from '@painter/shared';
import { pickTranslation } from '../../domain/localization';
import { toNumberOrNull } from './common';

export function toPublicSettingsDto(settings: SiteSettings, emailAvailable: boolean): PublicSettingsDto {
  return {
    businessName: settings.businessName,
    accentColor: settings.accentColor,
    instagramUrl: settings.instagramUrl,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    contactAddress: settings.contactAddress,
    enabledLocales: settings.enabledLocales.map(localeFromDb),
    budgetRequired: settings.budgetRequired,
    deadlineRequired: settings.deadlineRequired,
    emailAvailable,
  };
}

export function toServiceDto(service: Service & { translations: ServiceTranslation[] }, locale: Locale): ServiceDto {
  const t = pickTranslation(service.translations, locale);
  return {
    id: service.id,
    name: t?.name ?? '',
    description: t?.description ?? null,
    imageUrl: service.imageUrl,
    isWallService: service.isWallService,
  };
}

export function toPortfolioItemDto(
  item: PortfolioItem & { translations: PortfolioItemTranslation[] },
  locale: Locale,
): PortfolioItemDto {
  const t = pickTranslation(item.translations, locale);
  return {
    id: item.id,
    title: t?.title ?? '',
    description: t?.description ?? null,
    category: item.category,
    imageUrl: item.imageUrl,
    width: toNumberOrNull(item.width),
    height: toNumberOrNull(item.height),
    unit: item.unit,
    year: item.year,
    isFeatured: item.isFeatured,
    isSample: item.isSample,
    spaces: item.spaces,
    allowSimilarRequest: item.allowSimilarRequest,
  };
}

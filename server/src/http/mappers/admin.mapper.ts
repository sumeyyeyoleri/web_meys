import type { SiteSettings } from '@prisma/client';
import {
  canArchive,
  LOCALES,
  localeToDb,
  type AdminOrderDetailDto,
  type AdminOrderSummaryDto,
  type AdminPortfolioItemDto,
  type AdminServiceDto,
  type AdminSettingsDto,
  type InternalNoteDto,
  type Locale,
  type Translations,
} from '@painter/shared';
import type { AdminServiceWithCount, PortfolioWithTranslations } from '../../repositories/admin-content.repository';
import type { AdminOrderWithSummary, InternalNoteWithAuthor } from '../../repositories/admin-order.repository';
import type { OrderWithDetail } from '../../repositories/order.repository';
import { toIso, toIsoOrNull, toNumberOrNull } from './common';
import { toPublicSettingsDto } from './content.mapper';
import { toOrderDetailDto, toOrderSummaryDto } from './order.mapper';

export function toAdminOrderSummaryDto(order: AdminOrderWithSummary, locale: Locale, unread: number): AdminOrderSummaryDto {
  return {
    ...toOrderSummaryDto(order, locale, unread),
    customerName: order.contactName,
    customerEmail: order.contactEmail,
    customerPhone: order.contactPhone,
    archivedAt: toIsoOrNull(order.archivedAt),
  };
}

export function toInternalNoteDto(note: InternalNoteWithAuthor): InternalNoteDto {
  return { id: note.id, body: note.body, authorEmail: note.author.email, createdAt: toIso(note.createdAt) };
}

export function toAdminOrderDetailDto(
  detail: { order: OrderWithDetail; notes: InternalNoteWithAuthor[]; customerAccountEmail: string; unreadMessages: number },
  locale: Locale,
): AdminOrderDetailDto {
  const { order } = detail;
  return {
    ...toOrderDetailDto(order, locale, 'ADMIN', detail.unreadMessages),
    customerId: order.customerId,
    customerAccountEmail: detail.customerAccountEmail,
    internalNotes: detail.notes.map(toInternalNoteDto),
    canArchive: !order.archivedAt && canArchive(order.status),
  };
}

function byLocale<R extends { locale: string }, T>(rows: R[], pick: (row: R | undefined) => T): Translations<T> {
  const entries = LOCALES.map((locale) => [locale, pick(rows.find((r) => r.locale === localeToDb(locale)))] as const);
  return Object.fromEntries(entries) as Translations<T>;
}

export function toAdminPortfolioItemDto(item: PortfolioWithTranslations): AdminPortfolioItemDto {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    category: item.category,
    width: toNumberOrNull(item.width),
    height: toNumberOrNull(item.height),
    unit: item.unit,
    year: item.year,
    isFeatured: item.isFeatured,
    isPublished: item.isPublished,
    isSample: item.isSample,
    sortOrder: item.sortOrder,
    translations: byLocale(item.translations, (t) => ({ title: t?.title ?? '', description: t?.description ?? null })),
  };
}

export function toAdminServiceDto(service: AdminServiceWithCount): AdminServiceDto {
  return {
    id: service.id,
    imageUrl: service.imageUrl,
    isActive: service.isActive,
    isWallService: service.isWallService,
    sortOrder: service.sortOrder,
    orderCount: service._count.orders,
    translations: byLocale(service.translations, (t) => ({ name: t?.name ?? '', description: t?.description ?? null })),
  };
}

export function toAdminSettingsDto(settings: SiteSettings, smtpConfigured: boolean): AdminSettingsDto {
  return {
    ...toPublicSettingsDto(settings),
    emailNotificationsEnabled: settings.emailNotificationsEnabled,
    smtpConfigured,
  };
}

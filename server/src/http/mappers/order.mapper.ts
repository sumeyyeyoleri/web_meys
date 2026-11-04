import {
  getAllowedTransitions,
  localeFromDb,
  type AttachmentDto,
  type InspirationDto,
  type Locale,
  type OrderDetailDto,
  type OrderSummaryDto,
  type StatusActor,
  type StatusHistoryDto,
} from '@painter/shared';
import { pickTranslation } from '../../domain/localization';
import type { OrderWithDetail, OrderWithSummary } from '../../repositories/order.repository';
import { toDateOnlyOrNull, toIso, toIsoOrNull, toNumber, toNumberOrNull } from './common';

export function toOrderSummaryDto(order: OrderWithSummary, locale: Locale, unreadMessages: number): OrderSummaryDto {
  return {
    id: order.id,
    reference: order.reference,
    title: order.title,
    status: order.status,
    serviceName: order.service ? (pickTranslation(order.service.translations, locale)?.name ?? null) : null,
    quoteAmount: toNumberOrNull(order.quoteAmount),
    unreadMessages,
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
  };
}

/** Customers load images through the tracking routes (with the token header), the artist with the session. */
function toAttachmentDto(attachment: OrderWithDetail['attachments'][number], viaTracking: boolean): AttachmentDto {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: viaTracking ? `/api/track/attachments/${attachment.id}` : `/api/attachments/${attachment.id}`,
    createdAt: toIso(attachment.createdAt),
  };
}

function toStatusHistoryDto(entry: OrderWithDetail['statusHistory'][number]): StatusHistoryDto {
  return {
    id: entry.id,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    changedByRole: entry.changedByRole,
    note: entry.note,
    quoteAmount: toNumberOrNull(entry.quoteAmount),
    createdAt: toIso(entry.createdAt),
  };
}

function toInspirationDto(order: OrderWithDetail): InspirationDto | null {
  const item = order.inspirationItem;
  if (!item) return null;
  // Shown in the order's communication language, whoever is viewing.
  const title = pickTranslation(item.translations, localeFromDb(order.communicationLocale))?.title ?? '';
  return { id: item.id, title, imageUrl: item.imageUrl };
}

export function toOrderDetailDto(
  order: OrderWithDetail,
  locale: Locale,
  viewer: StatusActor,
  unreadMessages: number,
  options: { viaTracking?: boolean } = {},
): OrderDetailDto {
  return {
    ...toOrderSummaryDto(order, locale, unreadMessages),
    serviceId: order.serviceId,
    customRequest: order.customRequest,
    inspiration: toInspirationDto(order),
    additionalSpecs: order.additionalSpecs,
    isWallService: order.service?.isWallService ?? false,
    width: toNumber(order.width),
    height: toNumber(order.height),
    unit: order.unit,
    wallWidth: toNumberOrNull(order.wallWidth),
    wallHeight: toNumberOrNull(order.wallHeight),
    surfaceDetails: order.surfaceDetails,
    extraSpecifications: order.extraSpecifications,
    description: order.description,
    stylePreferences: order.stylePreferences,
    colorPreferences: order.colorPreferences,
    themePreferences: order.themePreferences,
    budgetMin: toNumberOrNull(order.budgetMin),
    budgetMax: toNumberOrNull(order.budgetMax),
    deadline: toDateOnlyOrNull(order.deadline),
    extraInstructions: order.extraInstructions,
    contact: {
      fullName: order.contactName,
      email: order.contactEmail,
      phone: order.contactPhone,
      communicationLocale: localeFromDb(order.communicationLocale),
    },
    projectAddress: {
      country: order.projectCountry,
      city: order.projectCity,
      postalCode: order.projectPostalCode,
      street: order.projectStreet,
      houseNumber: order.projectHouseNumber,
      addressExtra: order.projectAddressExtra,
    },
    quoteSentAt: toIsoOrNull(order.quoteSentAt),
    archivedAt: toIsoOrNull(order.archivedAt),
    attachments: order.attachments.map((a) => toAttachmentDto(a, options.viaTracking ?? false)),
    statusHistory: order.statusHistory.map(toStatusHistoryDto),
    allowedTransitions: order.archivedAt ? [] : [...getAllowedTransitions(order.status, viewer)],
  };
}

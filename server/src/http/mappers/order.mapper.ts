import {
  getAllowedTransitions,
  localeFromDb,
  type AttachmentDto,
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

function toAttachmentDto(attachment: OrderWithDetail['attachments'][number]): AttachmentDto {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: `/api/attachments/${attachment.id}`,
    createdAt: toIso(attachment.createdAt),
  };
}

function toStatusHistoryDto(entry: OrderWithDetail['statusHistory'][number]): StatusHistoryDto {
  return {
    id: entry.id,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    changedByRole: entry.changedBy.role,
    note: entry.note,
    quoteAmount: toNumberOrNull(entry.quoteAmount),
    createdAt: toIso(entry.createdAt),
  };
}

export function toOrderDetailDto(
  order: OrderWithDetail,
  locale: Locale,
  viewer: StatusActor,
  unreadMessages: number,
): OrderDetailDto {
  return {
    ...toOrderSummaryDto(order, locale, unreadMessages),
    serviceId: order.serviceId,
    customRequest: order.customRequest,
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
    attachments: order.attachments.map(toAttachmentDto),
    statusHistory: order.statusHistory.map(toStatusHistoryDto),
    allowedTransitions: order.archivedAt ? [] : [...getAllowedTransitions(order.status, viewer)],
  };
}

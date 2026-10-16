/**
 * Data transfer objects returned by the API. Dates are ISO 8601 strings,
 * calendar dates (deadline) are `YYYY-MM-DD`, money and sizes are numbers.
 */
import type { ContentKey, DimensionUnit, NotificationType, PortfolioCategory, Role } from './constants';
import type { Locale } from './locales';
import type { OrderStatus } from './order-status';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ---------- Users ---------- */

export interface CustomerProfileDto {
  fullName: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  houseNumber: string | null;
  addressExtra: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  preferredLocale: Locale;
  profile: CustomerProfileDto | null;
  createdAt: string;
}

export interface CsrfDto {
  csrfToken: string;
}

/* ---------- Public content ---------- */

export interface PublicSettingsDto {
  businessName: string;
  accentColor: string;
  instagramUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  enabledLocales: Locale[];
  budgetRequired: boolean;
  deadlineRequired: boolean;
}

export interface SiteDto {
  locale: Locale;
  settings: PublicSettingsDto;
  content: Partial<Record<ContentKey, string>>;
}

export interface ServiceDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isWallService: boolean;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  imageUrl: string;
  width: number | null;
  height: number | null;
  unit: DimensionUnit | null;
  year: number | null;
  isFeatured: boolean;
  isSample: boolean;
}

/* ---------- Orders ---------- */

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  /** Authorized URL: `/api/attachments/:id`. */
  url: string;
  createdAt: string;
}

export interface StatusHistoryDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByRole: Role;
  note: string | null;
  quoteAmount: number | null;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  senderRole: Role;
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  /** True when the current viewer wrote this message. */
  isOwn: boolean;
}

export interface OrderSummaryDto {
  id: string;
  reference: string;
  title: string;
  status: OrderStatus;
  serviceName: string | null;
  quoteAmount: number | null;
  unreadMessages: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  serviceId: string | null;
  customRequest: string | null;
  isWallService: boolean;
  width: number;
  height: number;
  unit: DimensionUnit;
  wallWidth: number | null;
  wallHeight: number | null;
  surfaceDetails: string | null;
  extraSpecifications: string | null;
  description: string;
  stylePreferences: string | null;
  colorPreferences: string | null;
  themePreferences: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  deadline: string | null;
  extraInstructions: string | null;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    communicationLocale: Locale;
  };
  projectAddress: {
    country: string;
    city: string;
    postalCode: string;
    street: string;
    houseNumber: string;
    addressExtra: string | null;
  };
  quoteSentAt: string | null;
  archivedAt: string | null;
  attachments: AttachmentDto[];
  statusHistory: StatusHistoryDto[];
  allowedTransitions: OrderStatus[];
}

/** Returned by POST /api/orders. `created` is false for an idempotent repeat. */
export interface CreateOrderResultDto {
  order: OrderDetailDto;
  created: boolean;
  user: UserDto;
}

/* ---------- Notifications ---------- */

export interface NotificationDto {
  id: string;
  type: NotificationType;
  orderId: string | null;
  orderReference: string | null;
  /** Status the order moved to (ORDER_STATUS_CHANGED only). */
  status: OrderStatus | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountDto {
  count: number;
}

/* ---------- Admin ---------- */

export interface AdminOrderSummaryDto extends OrderSummaryDto {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  archivedAt: string | null;
}

export interface InternalNoteDto {
  id: string;
  body: string;
  authorEmail: string;
  createdAt: string;
}

export interface AdminOrderDetailDto extends OrderDetailDto {
  customerId: string;
  customerAccountEmail: string;
  internalNotes: InternalNoteDto[];
  canArchive: boolean;
}

export interface AdminStatsDto {
  totalOrders: number;
  newOrders: number;
  awaitingReview: number;
  inProgress: number;
  completed: number;
  unreadCustomerMessages: number;
  recentOrders: AdminOrderSummaryDto[];
  recentMessages: Array<{
    id: string;
    orderId: string;
    orderReference: string;
    customerName: string;
    body: string;
    readAt: string | null;
    createdAt: string;
  }>;
}

export type Translations<T> = Record<Locale, T>;

export interface AdminPortfolioItemDto {
  id: string;
  imageUrl: string;
  category: PortfolioCategory;
  width: number | null;
  height: number | null;
  unit: DimensionUnit | null;
  year: number | null;
  isFeatured: boolean;
  isPublished: boolean;
  isSample: boolean;
  sortOrder: number;
  translations: Translations<{ title: string; description: string | null }>;
}

export interface AdminServiceDto {
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  isWallService: boolean;
  sortOrder: number;
  orderCount: number;
  translations: Translations<{ name: string; description: string | null }>;
}

export interface AdminContentDto {
  items: Array<{ key: ContentKey; locale: Locale; value: string }>;
}

export interface AdminSettingsDto extends PublicSettingsDto {
  emailNotificationsEnabled: boolean;
  /** Whether SMTP credentials are present in the server environment. */
  smtpConfigured: boolean;
}

export interface MediaUploadDto {
  url: string;
}

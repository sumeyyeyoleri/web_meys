/**
 * Data transfer objects returned by the API. Dates are ISO 8601 strings,
 * calendar dates (deadline) are `YYYY-MM-DD`, money and sizes are numbers.
 */
import type { ContentKey, DimensionUnit, NotificationType, Role } from './constants';
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

/** The signed-in artist (the only accounts; customers order without one). */
export interface UserDto {
  id: string;
  email: string;
  /** Display name from "My account"; null when not set. */
  name: string | null;
  preferredLocale: Locale;
  createdAt: string;
}

export interface CsrfDto {
  csrfToken: string;
}

/* ---------- Public content ---------- */

export interface PublicSettingsDto {
  businessName: string;
  /** Uploaded logo; when null the business name is shown as a wordmark. */
  logoUrl: string | null;
  accentColor: string;
  instagramUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  enabledLocales: Locale[];
  /** Whether the site can send emails (SMTP configured); e.g. for password reset links. */
  emailAvailable: boolean;
  /** Whether messages can be machine-translated (DEEPL_API_KEY set); otherwise no "Translate" button. */
  translationAvailable: boolean;
  /** Home page welcome screen (once per browser session). */
  welcomeEnabled: boolean;
  /** Welcome background; null → the first featured artwork. */
  welcomeImageUrl: string | null;
}

export interface SiteDto {
  locale: Locale;
  settings: PublicSettingsDto;
  content: Partial<Record<ContentKey, string>>;
}

/** A category as a work or order refers to it. */
export interface CategoryRefDto {
  id: string;
  /** URL value: `/catalog?category=<slug>`. */
  slug: string;
  name: string;
}

/**
 * A category on the site: catalog filter (shown on the site and with works), card on the services
 * page (shown on the site) and choice in the order form (shown in the order form).
 */
export interface CategoryDto extends CategoryRefDto {
  description: string | null;
  coverImageUrl: string | null;
  /** Unit the order form switches to when this category is chosen. */
  defaultUnit: DimensionUnit | null;
  showOnSite: boolean;
  showInOrderForm: boolean;
  /** Has at least one work on the site (then it is a catalog filter). */
  hasWorks: boolean;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string | null;
  /** null = uncategorised. */
  category: CategoryRefDto | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
  unit: DimensionUnit | null;
  year: number | null;
  isFeatured: boolean;
  isSample: boolean;
  /** Whether "Request something similar" is offered for this item. */
  allowSimilarRequest: boolean;
}

/* ---------- Orders ---------- */

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  /** Authorized URL: `/api/attachments/:id` for the admin, `/api/track/attachments/:id` (with the tracking token) for the customer. */
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
  /** The sender's language when it was written (shown as NL/EN/TR). */
  locale: Locale;
  body: string;
  readAt: string | null;
  createdAt: string;
  /** True when the current viewer wrote this message. */
  isOwn: boolean;
}

/** A machine translation of a message (cached on the server per target language). */
export interface MessageTranslationDto {
  messageId: string;
  locale: Locale;
  body: string;
}

export interface OrderSummaryDto {
  id: string;
  reference: string;
  title: string;
  status: OrderStatus;
  /** The chosen category in the viewer's language, else the former service name. */
  categoryName: string | null;
  quoteAmount: number | null;
  unreadMessages: number;
  createdAt: string;
  updatedAt: string;
}

/** Catalog item an order was started from; title in the order's communication language. */
export interface InspirationDto {
  id: string;
  title: string;
  imageUrl: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  categoryId: string | null;
  /**
   * What the customer chose, when it differs from the current category (e.g. an older order's
   * service "Mural" that matched no category, or a category renamed since); otherwise null.
   */
  previousServiceName: string | null;
  /** Older orders only (6-step wizard): free-text request. */
  customRequest: string | null;
  inspiration: InspirationDto | null;
  /** Older orders only: requested changes compared to the inspiration example. */
  additionalSpecs: string | null;
  width: number;
  height: number;
  unit: DimensionUnit;
  wallWidth: number | null;
  wallHeight: number | null;
  surfaceDetails: string | null;
  extraSpecifications: string | null;
  description: string;
  /** Older orders only (the fields from here to `extraInstructions` are no longer asked). */
  stylePreferences: string | null;
  colorPreferences: string | null;
  themePreferences: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  deadline: string | null;
  extraInstructions: string | null;
  contact: {
    fullName: string;
    /** Optional since the single-page form without accounts. */
    email: string | null;
    /** Required for new orders; may be empty on older ones. */
    phone: string | null;
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

/** A freshly issued private tracking link. The token inside is shown only this once. */
export interface TrackingLinkDto {
  /** `${webOrigin}/track#<token>` */
  url: string;
  expiresAt: string;
  /** True only when the email with the link was accepted by the SMTP server. */
  emailSent: boolean;
}

/** Returned by POST /api/orders. `created` is false for an idempotent repeat. */
export interface CreateOrderResultDto {
  order: OrderDetailDto;
  created: boolean;
  /** The private link to follow the order (customers have no account). */
  tracking: TrackingLinkDto;
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
  customerEmail: string | null;
  customerPhone: string | null;
  archivedAt: string | null;
}

export interface InternalNoteDto {
  id: string;
  body: string;
  authorEmail: string;
  createdAt: string;
}

export interface AdminOrderDetailDto extends OrderDetailDto {
  internalNotes: InternalNoteDto[];
  canArchive: boolean;
}

export interface AdminStatsDto {
  totalOrders: number;
  /** SUBMITTED — not yet looked at. */
  newOrders: number;
  /** UNDER_REVIEW, AWAITING_CUSTOMER_INFO, QUOTE_SENT. */
  inReview: number;
  /** ACCEPTED, IN_PROGRESS. */
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
  /** null = uncategorised. */
  categoryId: string | null;
  /** The work's category is hidden, so the work is not shown on the site ("category hidden"). */
  categoryHidden: boolean;
  width: number | null;
  height: number | null;
  unit: DimensionUnit | null;
  year: number | null;
  isFeatured: boolean;
  isPublished: boolean;
  isSample: boolean;
  allowSimilarRequest: boolean;
  sortOrder: number;
  translations: Translations<{ title: string; description: string | null }>;
}

export interface AdminCategoryDto {
  id: string;
  slug: string;
  /** Hidden = the category and all its works are hidden on the site. */
  isVisible: boolean;
  sortOrder: number;
  showInOrderForm: boolean;
  coverImageUrl: string | null;
  defaultUnit: DimensionUnit | null;
  /** All works in it, published or not. */
  itemCount: number;
  orderCount: number;
  translations: Translations<{ name: string; description: string | null }>;
}

/** "Personalise your site" on the overview: true = done (from the real data, not ticked by hand). */
export interface SetupChecklistDto {
  logo: boolean;
  /** At least one work of her own (not a sample). */
  firstWork: boolean;
  /** The about text no longer is the sample text in any language. */
  aboutText: boolean;
  /** No sample work is published. */
  samplesHidden: boolean;
  /** Email or phone filled in and none of the placeholder contact details left. */
  contactDetails: boolean;
}

export interface HideSamplesResultDto {
  /** Number of sample works that were unpublished. */
  hidden: number;
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

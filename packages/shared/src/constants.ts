/** Upload limits for customer reference images (enforced on client and server). */
export const UPLOAD_MAX_FILES = 8;
export const UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type UploadMimeType = (typeof UPLOAD_ALLOWED_MIME_TYPES)[number];
export const UPLOAD_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

/** Limits for admin-uploaded public media (portfolio and service images). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;
export const ORDER_DESCRIPTION_MIN_LENGTH = 20;

export const ROLES = ['ADMIN', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const DIMENSION_UNITS = ['CM', 'M'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export const PORTFOLIO_CATEGORIES = ['PAINTING', 'MURAL', 'WALL_PAINTING', 'PORTRAIT', 'OTHER'] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export const NOTIFICATION_TYPES = ['ORDER_SUBMITTED', 'ORDER_STATUS_CHANGED', 'ORDER_MESSAGE'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Admin-editable text blocks, stored once per locale. */
export const CONTENT_KEYS = [
  'hero.eyebrow',
  'hero.title',
  'hero.subtitle',
  'about.title',
  'about.body',
  'instagram.text',
  'contact.intro',
  'contact.businessHours',
  'footer.tagline',
  'privacy.body',
] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

/** Human-readable order reference, e.g. ORD-2026-7K3QXM. Alphabet excludes 0/O, 1/I/L. */
export const ORDER_REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ORDER_REFERENCE_RANDOM_LENGTH = 6;
export const ORDER_REFERENCE_PATTERN = /^ORD-\d{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export const DEFAULT_ACCENT_COLOR = '#B4532A';
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MESSAGE_MAX_LENGTH = 5000;

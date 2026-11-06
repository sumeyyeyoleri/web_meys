import type { Locale } from '@painter/shared';

/** All React Query keys in one place, so invalidation stays consistent. */
export const queryKeys = {
  me: ['me'] as const,
  site: (locale: Locale) => ['site', locale] as const,
  categories: (locale: Locale) => ['categories', locale] as const,
  portfolio: (locale: Locale, filter: Record<string, string | undefined> = {}) => ['portfolio', locale, filter] as const,
  portfolioItem: (id: string, locale: Locale) => ['portfolio-item', id, locale] as const,
  /** The customer's order behind a tracking token (`/track#<token>`). */
  track: {
    order: (token: string, locale: Locale) => ['track', 'order', token, locale] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: ['notifications', 'list'] as const,
    unread: ['notifications', 'unread'] as const,
  },
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    setupChecklist: ['admin', 'setup-checklist'] as const,
    orderLists: ['admin', 'orders'] as const,
    orders: (filter: Record<string, unknown>) => ['admin', 'orders', filter] as const,
    order: (id: string) => ['admin', 'order', id] as const,
    messages: (id: string) => ['admin', 'messages', id] as const,
    portfolio: ['admin', 'portfolio'] as const,
    categories: ['admin', 'categories'] as const,
    content: ['admin', 'content'] as const,
    settings: ['admin', 'settings'] as const,
  },
};

import type { PortfolioCategory, Space } from '@painter/shared';

/** Readable, shareable URL values for catalog filters, e.g. `?category=mural&space=kids`. */
export const CATEGORY_SLUGS: Record<PortfolioCategory, string> = {
  PAINTING: 'painting',
  MURAL: 'mural',
  WALL_PAINTING: 'wall-painting',
  PORTRAIT: 'portrait',
  OTHER: 'other',
};

export const SPACE_SLUGS: Record<Space, string> = {
  LIVING_ROOM: 'living-room',
  BEDROOM: 'bedroom',
  KIDS_ROOM: 'kids',
  KITCHEN: 'kitchen',
  CAFE_SHOP: 'cafe-shop',
  OFFICE: 'office',
  OUTDOOR: 'outdoor',
};

function invert<K extends string>(map: Record<K, string>): Map<string, K> {
  return new Map(Object.entries(map).map(([key, slug]) => [slug as string, key as K]));
}

const CATEGORY_BY_SLUG = invert(CATEGORY_SLUGS);
const SPACE_BY_SLUG = invert(SPACE_SLUGS);

export const categoryFromSlug = (slug: string | null) => (slug ? CATEGORY_BY_SLUG.get(slug) : undefined);
export const spaceFromSlug = (slug: string | null) => (slug ? SPACE_BY_SLUG.get(slug) : undefined);

/** Order wizard entry point for "Request something similar". */
export const requestSimilarHref = (itemId: string) => `/order?from=${encodeURIComponent(itemId)}`;

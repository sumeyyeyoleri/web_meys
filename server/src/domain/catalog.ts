import type { Prisma } from '@prisma/client';

/**
 * A work is on the site when it is published and its category (if any) is visible:
 * hiding a category hides its works everywhere, "All" included (PROMPT.md §10).
 */
export function isOnSite(item: { isPublished: boolean; category: { isVisible: boolean } | null }): boolean {
  return item.isPublished && (item.category?.isVisible ?? true);
}

/** The same rule as a Prisma filter. */
export const onSiteWhere = {
  isPublished: true,
  OR: [{ categoryId: null }, { category: { isVisible: true } }],
} satisfies Prisma.PortfolioItemWhereInput;

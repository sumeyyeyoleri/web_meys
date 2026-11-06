/** Order form entry point for "Request something similar". */
export const requestSimilarHref = (itemId: string) => `/order?from=${encodeURIComponent(itemId)}`;

/** Order form with a category chosen (services page, home page). */
export const requestHref = (categorySlug: string) => `/order?category=${encodeURIComponent(categorySlug)}`;

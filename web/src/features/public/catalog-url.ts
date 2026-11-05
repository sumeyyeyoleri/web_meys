/** Order form entry point for "Request something similar". */
export const requestSimilarHref = (itemId: string) => `/order?from=${encodeURIComponent(itemId)}`;

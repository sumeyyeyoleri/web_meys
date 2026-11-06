import { useQuery } from '@tanstack/react-query';
import type { CategoryDto, PortfolioItemDto, SiteDto } from '@painter/shared';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/i18n';
import { queryKeys } from '../../lib/query-keys';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useSite() {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.site(locale),
    queryFn: ({ signal }) => api.get<SiteDto>('/api/site', { locale }, signal),
    staleTime: FIVE_MINUTES,
  });
}

/**
 * Categories shown on the site or in the order form. Catalog filters: `showOnSite && hasWorks`;
 * services page: `showOnSite`; order form: `showInOrderForm`.
 */
export function useCategories() {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.categories(locale),
    queryFn: ({ signal }) => api.get<CategoryDto[]>('/api/categories', { locale }, signal),
    staleTime: FIVE_MINUTES,
  });
}

export interface PortfolioFilter {
  /** Category slug. */
  category?: string;
  featured?: boolean;
}

export function usePortfolio(filter: PortfolioFilter = {}) {
  const locale = useLocale();
  const key = { category: filter.category, featured: filter.featured ? 'true' : undefined };
  return useQuery({
    queryKey: queryKeys.portfolio(locale, key),
    queryFn: ({ signal }) => api.get<PortfolioItemDto[]>('/api/portfolio', { locale, ...key }, signal),
    staleTime: FIVE_MINUTES,
  });
}

/** One published catalog item (order form `?from=<id>`). */
export function usePortfolioItem(id: string | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.portfolioItem(id ?? '', locale),
    queryFn: ({ signal }) => api.get<PortfolioItemDto>(`/api/portfolio/${encodeURIComponent(id ?? '')}`, { locale }, signal),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
    retry: false,
  });
}

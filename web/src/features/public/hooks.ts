import { useQuery } from '@tanstack/react-query';
import type { PortfolioItemDto, ServiceDto, SiteDto } from '@painter/shared';
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

export function useServices() {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.services(locale),
    queryFn: ({ signal }) => api.get<ServiceDto[]>('/api/services', { locale }, signal),
    staleTime: FIVE_MINUTES,
  });
}

export interface PortfolioFilter {
  category?: string;
  space?: string;
  featured?: boolean;
}

export function usePortfolio(filter: PortfolioFilter = {}) {
  const locale = useLocale();
  const key = { category: filter.category, space: filter.space, featured: filter.featured ? 'true' : undefined };
  return useQuery({
    queryKey: queryKeys.portfolio(locale, key),
    queryFn: ({ signal }) => api.get<PortfolioItemDto[]>('/api/portfolio', { locale, ...key }, signal),
    staleTime: FIVE_MINUTES,
  });
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PortfolioCategory, Space } from '@painter/shared';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { usePageTitle } from '../../lib/use-page-title';
import { CatalogCard } from './CatalogCard';
import { CatalogFilters } from './CatalogFilters';
import { CATEGORY_SLUGS, categoryFromSlug, SPACE_SLUGS, spaceFromSlug } from './catalog-url';
import { usePortfolio } from './hooks';
import { Lightbox } from './Lightbox';

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-12';

export function CatalogPage() {
  const { t } = useTranslation('public');
  usePageTitle(t('meta.catalogTitle'));
  const [params, setParams] = useSearchParams();
  const category = categoryFromSlug(params.get('category'));
  const space = spaceFromSlug(params.get('space'));
  const portfolio = usePortfolio({ category, space });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  /** Filters live in the URL so a filtered catalog can be shared. */
  const update = (next: { category?: PortfolioCategory; space?: Space }) => {
    const search = new URLSearchParams();
    if (next.category) search.set('category', CATEGORY_SLUGS[next.category]);
    if (next.space) search.set('space', SPACE_SLUGS[next.space]);
    setParams(search, { replace: true, preventScrollReset: true });
    setOpenIndex(null);
  };

  const items = portfolio.data ?? [];

  return (
    <div className="container-content flex flex-col gap-10 pt-36 pb-24 sm:pt-44">
      <header className="flex flex-col gap-4">
        <h1 className="text-5xl sm:text-7xl">{t('catalog.title')}</h1>
        <p className="max-w-2xl text-lg text-text-muted">{t('catalog.intro')}</p>
      </header>

      <CatalogFilters
        category={category}
        space={space}
        onCategory={(value) => update({ category: value, space })}
        onSpace={(value) => update({ category, space: value })}
      />

      <p className="text-sm text-text-subtle" aria-live="polite">
        {portfolio.isPending ? '' : t('catalog.results', { count: items.length })}
      </p>

      {portfolio.isPending ? (
        <div className={GRID} aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : portfolio.isError ? (
        <ErrorState error={portfolio.error} onRetry={() => void portfolio.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('catalog.emptyTitle')}
          description={t('catalog.emptyBody')}
          action={
            <Button variant="secondary" onClick={() => update({})}>
              {t('catalog.clearFilters')}
            </Button>
          }
        />
      ) : (
        <div className={GRID}>
          {items.map((item, i) => (
            <CatalogCard key={item.id} item={item} onOpen={() => setOpenIndex(i)} />
          ))}
        </div>
      )}

      <Lightbox items={items} index={openIndex} onIndexChange={setOpenIndex} />
    </div>
  );
}

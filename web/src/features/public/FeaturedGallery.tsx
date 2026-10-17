import { useState } from 'react';
import { Skeleton } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { CurvedCarousel } from './CurvedCarousel';
import { usePortfolio } from './hooks';
import { SelectedWorkPanel } from './SelectedWorkPanel';

/** Curved carousel of featured works + the synced selected-work panel. */
export function FeaturedGallery() {
  const featured = usePortfolio({ featured: true });
  const all = usePortfolio();
  const [index, setIndex] = useState(0);

  // Fall back to every published work when nothing is marked as featured.
  const items = featured.data?.length ? featured.data : (all.data ?? []);
  const loading = featured.isPending || (!featured.data?.length && all.isPending);

  if (loading) {
    return (
      <div className="container-content flex flex-col gap-10" aria-busy="true">
        <div className="flex h-[420px] items-center justify-center gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[320px] w-[200px] shrink-0" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-[var(--radius-panel)]" />
      </div>
    );
  }
  if (featured.isError && all.isError) {
    return (
      <div className="container-content">
        <ErrorState error={featured.error} onRetry={() => void featured.refetch()} />
      </div>
    );
  }
  if (items.length === 0) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const current = items[safeIndex]!;

  return (
    <div className="flex flex-col gap-10">
      <CurvedCarousel items={items} index={safeIndex} onIndexChange={setIndex} />
      <div className="container-content">
        <SelectedWorkPanel item={current} />
      </div>
    </div>
  );
}

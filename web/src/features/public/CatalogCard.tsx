import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { SampleBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { ArtworkImage } from './ArtworkImage';
import { requestSimilarHref } from './catalog-url';
import { useWorkCaption } from './WorkDetails';

export function CatalogCard({ item, onOpen }: { item: PortfolioItemDto; onOpen: () => void }) {
  const { t } = useTranslation('public');
  const caption = useWorkCaption();
  return (
    <article className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('catalog.openDetail', { title: item.title })}
        className="group relative block overflow-hidden rounded-[var(--radius-art)]"
      >
        <ArtworkImage
          src={item.imageUrl}
          alt=""
          className="aspect-[4/5] w-full transition-transform duration-500 ease-[var(--ease-gallery)] group-hover:scale-[1.03]"
        />
        {item.isSample ? <SampleBadge className="absolute top-3 left-3" /> : null}
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">{item.title}</h2>
          <p className="text-sm text-text-subtle">{caption(item)}</p>
        </div>
      </div>
      {item.allowSimilarRequest ? (
        <Link
          to={requestSimilarHref(item.id)}
          aria-label={t('work.requestSimilarFor', { title: item.title })}
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border border-border-strong px-4 text-sm font-semibold text-text transition-colors hover:border-text-muted hover:bg-surface-2"
        >
          {t('work.requestSimilarShort')}
          <Icon name="arrowRight" size={16} />
        </Link>
      ) : null}
    </article>
  );
}

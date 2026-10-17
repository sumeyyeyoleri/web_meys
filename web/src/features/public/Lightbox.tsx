import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { ButtonLink, IconButton } from '../../components/ui/Button';
import { SampleBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { ArtworkImage } from './ArtworkImage';
import { requestSimilarHref } from './catalog-url';
import { WorkDetails } from './WorkDetails';

interface LightboxProps {
  items: PortfolioItemDto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/** Full-screen detail view: ←/→ browse, Esc closes, focus is trapped by the modal dialog. */
export function Lightbox({ items, index, onIndexChange }: LightboxProps) {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  const item = index === null ? undefined : items[index];
  const total = items.length;
  const go = (delta: number) => index !== null && onIndexChange((index + delta + total) % total);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  };

  return (
    <Dialog open={item !== undefined} onClose={() => onIndexChange(null)} title={item?.title ?? ''} variant="sheet" hideTitle>
      {item ? (
        <div onKeyDown={onKeyDown} className="grid min-h-[calc(100dvh-120px)] gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-12">
          <div className="flex min-h-[50vh] flex-col gap-4">
            <div className="flex flex-1 items-center justify-center rounded-[var(--radius-card)] bg-surface p-4">
              <ArtworkImage key={item.id} src={item.imageUrl} alt={item.title} fit="contain" className="max-h-[70vh] max-w-full" eager />
            </div>
            {total > 1 ? (
              <div className="flex items-center justify-center gap-5">
                <IconButton label={t('lightbox.previous')} onClick={() => go(-1)} className="border border-border-strong">
                  <Icon name="arrowLeft" />
                </IconButton>
                <p className="min-w-16 text-center text-sm text-text-muted tabular-nums" aria-live="polite">
                  {t('lightbox.position', { current: (index ?? 0) + 1, total })}
                </p>
                <IconButton label={t('lightbox.next')} onClick={() => go(1)} className="border border-border-strong">
                  <Icon name="arrowRight" />
                </IconButton>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-5 lg:pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {item.isSample ? <SampleBadge /> : null}
              <span className="eyebrow">{tc(`category.${item.category}`)}</span>
            </div>
            <p className="font-display text-5xl leading-[1.1]" aria-hidden="true">
              {item.title}
            </p>
            {item.description ? <p className="text-text-muted">{item.description}</p> : null}
            <WorkDetails item={item} />
            {item.allowSimilarRequest ? (
              <>
                <ButtonLink to={requestSimilarHref(item.id)} className="mt-2 self-start">
                  {t('work.requestSimilar')}
                  <Icon name="arrowRight" size={18} />
                </ButtonLink>
                <p className="text-sm text-text-subtle">{t('work.attachNote')}</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

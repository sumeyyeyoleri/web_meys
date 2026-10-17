import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { ButtonLink } from '../../components/ui/Button';
import { SampleBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { ArtworkImage } from './ArtworkImage';
import { requestSimilarHref } from './catalog-url';
import { WorkDetails } from './WorkDetails';

/** Details of the work currently centred in the carousel. */
export function SelectedWorkPanel({ item }: { item: PortfolioItemDto }) {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();

  return (
    <article
      aria-labelledby="selected-work-title"
      className="grid gap-8 rounded-[var(--radius-panel)] border border-border bg-surface p-4 sm:p-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:p-8"
    >
      <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] bg-bg p-3 sm:p-6">
        <ArtworkImage key={item.id} src={item.imageUrl} alt={item.title} fit="contain" className="max-h-full max-w-full" />
      </div>

      <div className="flex flex-col gap-5 lg:py-2">
        <div className="flex flex-wrap items-center gap-3">
          {item.isSample ? <SampleBadge /> : null}
          <span className="eyebrow">{tc(`category.${item.category}`)}</span>
        </div>
        <div>
          <p className="eyebrow mb-2 text-text-subtle">{t('work.selectedHeading')}</p>
          <h2 id="selected-work-title" className="text-4xl sm:text-5xl">
            {item.title}
          </h2>
        </div>
        {item.description ? <p className="text-text-muted">{item.description}</p> : null}
        <WorkDetails item={item} />
        <div className="mt-2 flex flex-wrap gap-3">
          {item.allowSimilarRequest ? (
            <ButtonLink to={requestSimilarHref(item.id)} aria-label={t('work.requestSimilarFor', { title: item.title })}>
              {t('work.requestSimilar')}
              <Icon name="arrowRight" size={18} />
            </ButtonLink>
          ) : null}
          <ButtonLink to="/catalog" variant="secondary">
            {t('work.browseCatalog')}
          </ButtonLink>
        </div>
        {item.allowSimilarRequest ? <p className="text-sm text-text-subtle">{t('work.attachNote')}</p> : null}
      </div>
    </article>
  );
}

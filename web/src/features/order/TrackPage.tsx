import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OrderDetailDto } from '@painter/shared';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { isApiError, trackingApi } from '../../lib/api';
import { formatDate, formatDateTime, formatDimensions } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { queryKeys } from '../../lib/query-keys';
import { usePageTitle } from '../../lib/use-page-title';

/** The token from `/track#<token>` (the fragment is never sent to the server by the browser). */
function useTrackingToken(): string {
  return useLocation().hash.replace(/^#/, '');
}

/**
 * The customer's order page, opened with the private tracking link: reference, status and its history.
 * (Phase 8 adds the reference images, the message thread and accept/cancel here.)
 */
export function TrackPage() {
  const { t } = useTranslation('order');
  usePageTitle(t('track.title'));
  const locale = useLocale();
  const token = useTrackingToken();
  const order = useQuery({
    queryKey: queryKeys.track.order(token, locale),
    queryFn: ({ signal }) => trackingApi(token).get<OrderDetailDto>('/api/track/order', { locale }, signal),
    enabled: token.length > 0,
    retry: (count, error) => !isApiError(error, 'NOT_FOUND') && count < 2,
  });

  if (!token || isApiError(order.error, 'NOT_FOUND')) {
    return (
      <div className="container-content flex justify-center pt-36 pb-24 sm:pt-44">
        <div className="flex w-full max-w-2xl flex-col gap-6 text-center">
          <h1 className="text-5xl">{t('track.invalidTitle')}</h1>
          <p className="text-text-muted">{t('track.invalidBody')}</p>
          <ButtonLink to="/contact" variant="secondary" className="self-center">
            {t('track.contact')}
          </ButtonLink>
        </div>
      </div>
    );
  }
  if (order.isPending) return <LoadingBlock className="min-h-[60vh]" />;
  if (order.isError) {
    return (
      <div className="container-content pt-40 pb-24">
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </div>
    );
  }

  const o = order.data;
  return (
    <div className="container-content flex justify-center pt-36 pb-24 sm:pt-44">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="eyebrow">{t('track.eyebrow')}</p>
          <h1 className="text-5xl sm:text-6xl">{o.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-text-muted">
            <span className="font-sans font-semibold tracking-[0.08em] text-text">{o.reference}</span>
            <StatusBadge status={o.status} />
            <span>{t('track.submittedOn', { date: formatDate(o.createdAt, locale) })}</span>
          </div>
        </header>

        <dl className="grid gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-[15px] sm:grid-cols-[minmax(140px,auto)_1fr]">
          {o.categoryName ? (
            <div className="contents">
              <dt className="text-text-subtle">{t('form.category')}</dt>
              <dd>{o.categoryName}</dd>
            </div>
          ) : null}
          <div className="contents">
            <dt className="text-text-subtle">{t('form.size')}</dt>
            <dd>{formatDimensions(o.width, o.height, o.unit, locale)}</dd>
          </div>
          <div className="contents">
            <dt className="text-text-subtle">{t('form.description')}</dt>
            <dd className="whitespace-pre-line">{o.description}</dd>
          </div>
        </dl>

        <section aria-labelledby="history-title" className="flex flex-col gap-4">
          <h2 id="history-title" className="text-3xl">
            {t('track.history')}
          </h2>
          <ol className="flex flex-col gap-3">
            {o.statusHistory.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 border-l border-border pl-4">
                <StatusBadge status={entry.toStatus} />
                <span className="text-sm text-text-muted">{formatDateTime(entry.createdAt, locale)}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-sm text-text-muted">{t('track.keepLink')}</p>
      </div>
    </div>
  );
}

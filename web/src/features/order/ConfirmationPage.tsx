import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OrderDetailDto } from '@painter/shared';
import { ButtonLink } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/i18n';
import { queryKeys } from '../../lib/query-keys';
import { usePageTitle } from '../../lib/use-page-title';
import { ArtworkImage } from '../public/ArtworkImage';

interface ConfirmationState {
  accountCreated?: boolean;
  email?: string;
}

/** Shown after submitting: reference, what happens next, link to the order in the account. */
export function ConfirmationPage() {
  const { t } = useTranslation('order');
  usePageTitle(t('meta.confirmationTitle'));
  const { orderId = '' } = useParams();
  const locale = useLocale();
  const state = (useLocation().state ?? {}) as ConfirmationState;
  const order = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: ({ signal }) => api.get<OrderDetailDto>(`/api/orders/${encodeURIComponent(orderId)}`, { locale }, signal),
  });

  if (order.isPending) return <LoadingBlock className="min-h-[60vh]" />;
  if (order.isError) {
    return (
      <div className="container-content pt-40 pb-24">
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </div>
    );
  }

  const { reference, inspiration } = order.data;
  return (
    <div className="container-content flex justify-center pt-36 pb-24 sm:pt-44">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4 text-center">
          <p className="eyebrow">{t('confirmation.eyebrow')}</p>
          <h1 className="text-5xl sm:text-6xl">{t('confirmation.title')}</h1>
          <div className="mx-auto mt-2 flex flex-col items-center gap-1 rounded-[var(--radius-card)] border border-accent/60 bg-selected px-8 py-4">
            <span className="text-sm text-text-muted">{t('confirmation.reference')}</span>
            <span className="font-sans text-2xl font-semibold tracking-[0.08em] text-text">{reference}</span>
          </div>
        </header>

        {state.accountCreated && state.email ? (
          <FormAlert tone="success">{t('confirmation.accountCreated', { email: state.email })}</FormAlert>
        ) : null}

        {inspiration ? (
          <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <ArtworkImage src={inspiration.imageUrl} alt="" className="size-16 shrink-0" />
            <p>{t('inspiration.inspiredBy', { title: inspiration.title })}</p>
          </div>
        ) : null}

        <section aria-labelledby="next-title" className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
          <h2 id="next-title" className="mb-5 text-3xl">
            {t('confirmation.nextTitle')}
          </h2>
          <ol className="flex flex-col gap-4">
            {(['next1', 'next2', 'next3'] as const).map((key, i) => (
              <li key={key} className="flex gap-4">
                <span className="font-display text-3xl leading-none text-accent" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-text-muted">{t(`confirmation.${key}`)}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink to={`/account/orders/${orderId}`}>{t('confirmation.viewOrder')}</ButtonLink>
          <ButtonLink to="/" variant="secondary">
            {t('confirmation.home')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

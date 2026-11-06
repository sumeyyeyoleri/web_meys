import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SetupChecklistDto } from '@painter/shared';
import { StatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { formatDate, formatRelativeTime } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { AdminPageHeader } from './AdminPageHeader';
import { useAdminStats, useSetupChecklist } from './hooks';

/** Overview: order counters, recent orders and recent customer messages (PROMPT.md §10). */
export function DashboardPage() {
  const { t } = useTranslation('admin');
  const locale = useLocale();
  const stats = useAdminStats();

  const tiles = stats.data
    ? [
        { label: t('dashboard.total'), value: stats.data.totalOrders, to: '/admin/orders' },
        { label: t('dashboard.new'), value: stats.data.newOrders, to: '/admin/orders?status=SUBMITTED' },
        { label: t('dashboard.inReview'), value: stats.data.inReview },
        { label: t('dashboard.inProgress'), value: stats.data.inProgress },
        { label: t('dashboard.completed'), value: stats.data.completed, to: '/admin/orders?status=COMPLETED' },
        { label: t('dashboard.unreadMessages'), value: stats.data.unreadCustomerMessages },
      ]
    : [];

  return (
    <>
      <AdminPageHeader title={t('dashboard.title')} intro={t('dashboard.intro')} />
      <SetupChecklist />
      {stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.isPending
          ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />)
          : tiles.map((tile) => {
              const content = (
                <>
                  <span className="font-display text-4xl leading-none tabular-nums">{tile.value}</span>
                  <span className="text-sm text-text-muted">{tile.label}</span>
                </>
              );
              const box = 'flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-4';
              return (
                <li key={tile.label}>
                  {tile.to ? (
                    <Link to={tile.to} className={`${box} transition-colors hover:border-border-strong`}>
                      {content}
                    </Link>
                  ) : (
                    <div className={box}>{content}</div>
                  )}
                </li>
              );
            })}
      </ul>

      {stats.data ? (
        <div className="mt-10 grid gap-8 xl:grid-cols-2">
          <section aria-labelledby="recent-orders" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-orders" className="font-sans text-lg font-semibold">
                {t('dashboard.recentOrders')}
              </h2>
              <Link to="/admin/orders" className="inline-flex min-h-11 items-center text-sm text-text-muted underline-offset-4 hover:text-text hover:underline">
                {t('dashboard.allOrders')}
              </Link>
            </div>
            {stats.data.recentOrders.length === 0 ? (
              <p className="text-text-muted">{t('dashboard.noOrders')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
                {stats.data.recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link to={`/admin/orders/${order.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2">
                      <span className="font-semibold tracking-[0.04em]">{order.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-text-muted">{order.customerName}</span>
                      <StatusBadge status={order.status} />
                      <span className="text-sm text-text-subtle">{formatDate(order.createdAt, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recent-messages" className="flex flex-col gap-4">
            <h2 id="recent-messages" className="font-sans text-lg font-semibold">
              {t('dashboard.recentMessages')}
            </h2>
            {stats.data.recentMessages.length === 0 ? (
              <p className="text-text-muted">{t('dashboard.noMessages')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
                {stats.data.recentMessages.map((message) => (
                  <li key={message.id}>
                    <Link to={`/admin/orders/${message.orderId}#messages`} className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-2">
                      <span className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className={message.readAt ? 'text-text-muted' : 'font-semibold text-text'}>{message.customerName}</span>
                        <span className="text-text-subtle">{message.orderReference}</span>
                        <span className="text-text-subtle">· {formatRelativeTime(message.createdAt, locale)}</span>
                        {message.readAt ? null : <span className="size-2 rounded-full bg-accent" aria-label={t('dashboard.unread')} />}
                      </span>
                      <span className="line-clamp-2 text-text-muted">{message.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

const SETUP_STEPS: Array<{ key: keyof SetupChecklistDto; to: string }> = [
  { key: 'logo', to: '/admin/settings' },
  { key: 'firstWork', to: '/admin/catalog' },
  { key: 'aboutText', to: '/admin/texts' },
  { key: 'samplesHidden', to: '/admin/catalog' },
  { key: 'contactDetails', to: '/admin/settings' },
];

/** "Personalise your site" (PROMPT.md §18.3): ticked off from the real data; gone once everything is done. */
function SetupChecklist() {
  const { t } = useTranslation('admin');
  const checklist = useSetupChecklist();
  if (!checklist.data) return null;
  const done = SETUP_STEPS.filter((step) => checklist.data[step.key]).length;
  if (done === SETUP_STEPS.length) return null;

  return (
    <section aria-labelledby="setup-title" className="mb-8 rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="setup-title" className="font-sans text-lg font-semibold">
          {t('setup.title')}
        </h2>
        <span className="text-sm text-text-muted">{t('setup.progress', { done, total: SETUP_STEPS.length })}</span>
      </div>
      <p className="mt-1 text-sm text-text-muted">{t('setup.intro')}</p>
      <ul className="mt-4 flex flex-col divide-y divide-border">
        {SETUP_STEPS.map((step) => {
          const complete = checklist.data[step.key];
          return (
            <li key={step.key}>
              <Link to={step.to} className="flex min-h-11 items-center gap-3 py-2 transition-colors hover:text-text">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-accent bg-accent text-on-accent' : 'border-border-strong'}`}
                >
                  {complete ? <Icon name="check" size={14} /> : null}
                </span>
                <span className={complete ? 'text-text-subtle line-through' : 'text-text'}>{t(`setup.steps.${step.key}`)}</span>{' '}
                <span className="sr-only">{complete ? t('setup.done') : t('setup.todo')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

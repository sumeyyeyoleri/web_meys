import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ORDER_STATUSES, type AdminOrderSummaryDto } from '@painter/shared';
import { StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Checkbox, Input, Select } from '../../../components/ui/Inputs';
import { Pagination } from '../../../components/ui/Pagination';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../../components/ui/States';
import { formatDate } from '../../../lib/format';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminOrders, type OrderListFilter } from '../hooks';

/** Filters live in the URL, so reloading, sharing and the back button keep them. */
function useFilterParams() {
  const [params, setParams] = useSearchParams();
  const filter: OrderListFilter = {
    page: Math.max(1, Number(params.get('page')) || 1),
    status: params.get('status') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    q: params.get('q') ?? undefined,
    includeArchived: params.get('archived') === '1',
  };
  const update = (changes: Partial<Record<'status' | 'from' | 'to' | 'q' | 'archived' | 'page', string | undefined>>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change starts again on page 1.
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };
  return { filter, update };
}

/**
 * The whole row or card opens the order: by click, or by Tab + Enter (it is focusable and
 * shows the focus ring). Its accessible name says which order it opens.
 */
function useOpenOrder() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  return (order: AdminOrderSummaryDto) => {
    const open = () => void navigate(`/admin/orders/${order.id}`);
    return {
      tabIndex: 0,
      'aria-label': t('orders.open', { reference: order.reference }),
      onClick: () => {
        // Selecting text (e.g. copying a phone number) is not a click.
        if (window.getSelection()?.toString()) return;
        open();
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) open();
      },
    };
  };
}

/** Orders: filter by status and date, search, archived toggle, server-side pagination (PROMPT.md §10). */
export function OrdersPage() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const { filter, update } = useFilterParams();
  const [search, setSearch] = useState(filter.q ?? '');
  const orders = useAdminOrders(filter);
  const openOrder = useOpenOrder();
  const filtered = !!(filter.status || filter.from || filter.to || filter.q);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: search.trim() || undefined });
  }

  return (
    <>
      <AdminPageHeader title={t('orders.title')} />

      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
        <form role="search" onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t('orders.search')} hint={t('orders.searchHint')} className="flex-1">
            {(p) => <Input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
          </Field>
          <Button type="submit" variant="secondary" className="sm:mb-7">
            {t('orders.searchSubmit')}
          </Button>
        </form>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('orders.status')}>
            {(p) => (
              <Select {...p} value={filter.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })}>
                <option value="">{t('orders.allStatuses')}</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tc(`status.${status}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('orders.from')}>
            {(p) => <Input {...p} type="date" value={filter.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />}
          </Field>
          <Field label={t('orders.to')}>
            {(p) => <Input {...p} type="date" value={filter.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            id="orders-archived"
            label={t('orders.includeArchived')}
            checked={!!filter.includeArchived}
            onChange={(e) => update({ archived: e.target.checked ? '1' : undefined })}
          />
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                update({ status: undefined, from: undefined, to: undefined, q: undefined });
              }}
            >
              {t('orders.clearFilters')}
            </Button>
          ) : null}
        </div>
      </div>

      {orders.isPending ? (
        <LoadingBlock />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState icon="inbox" title={filtered ? t('orders.noResults') : t('orders.empty')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-text-muted" aria-live="polite">
            {t('orders.count', { count: orders.data.total })}
          </p>
          {/* Table on wide screens, cards on phones and tablets. */}
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-border lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-surface text-sm text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('orders.colReference')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('orders.colCustomer')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('orders.colRequest')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('orders.colStatus')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('orders.colDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.data.items.map((order) => (
                  <tr key={order.id} {...openOrder(order)} className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2">
                    <td className="px-4 py-3">
                      <span className="inline-flex min-h-11 items-center gap-2 font-semibold tracking-[0.04em]">
                        {order.reference}
                        <UnreadDot order={order} />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{order.customerName}</div>
                      <div className="text-sm text-text-subtle">{order.customerPhone ?? order.customerEmail}</div>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <div className="truncate">{order.title}</div>
                      {order.serviceName ? <div className="text-sm text-text-subtle">{order.serviceName}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                      {order.archivedAt ? <div className="mt-1 text-xs text-text-subtle">{t('orders.archived')}</div> : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-muted">{formatDate(order.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 lg:hidden">
            {orders.data.items.map((order) => (
              <li key={order.id}>
                <div
                  role="link"
                  {...openOrder(order)}
                  className="flex cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-semibold tracking-[0.04em]">
                      {order.reference}
                      <UnreadDot order={order} />
                    </span>
                    <StatusBadge status={order.status} />
                  </span>
                  <span>{order.customerName}</span>
                  <span className="truncate text-sm text-text-muted">{order.title}</span>
                  <span className="text-sm text-text-subtle">
                    {formatDate(order.createdAt, locale)}
                    {order.archivedAt ? ` · ${t('orders.archived')}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Pagination page={orders.data.page} totalPages={orders.data.totalPages} onChange={(page) => update({ page: String(page) })} />
          </div>
        </>
      )}
    </>
  );
}

function UnreadDot({ order }: { order: AdminOrderSummaryDto }) {
  const { t } = useTranslation('admin');
  if (!order.unreadMessages) return null;
  return (
    <span className="rounded-full bg-accent px-2 text-xs leading-5 font-bold text-on-accent">
      {order.unreadMessages}
      <span className="sr-only"> {t('nav.unreadMessages', { count: order.unreadMessages })}</span>
    </span>
  );
}

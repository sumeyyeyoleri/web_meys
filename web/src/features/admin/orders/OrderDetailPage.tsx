import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminOrderDetailDto } from '@painter/shared';
import { StatusBadge } from '../../../components/ui/Badge';
import { Button, buttonClasses } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { ImageViewer } from '../../../components/ui/ImageViewer';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { mediaUrl } from '../../../lib/api';
import { formatCalendarDate, formatCurrency, formatDate, formatDateTime, formatDimensions } from '../../../lib/format';
import { useLocale } from '../../../lib/i18n';
import { telHref, whatsappHref } from '../../../lib/phone';
import { ArtworkImage } from '../../public/ArtworkImage';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminOrder, useArchiveOrder } from '../hooks';
import { EditOrderDialog } from './EditOrderDialog';
import { InternalNotes } from './InternalNotes';
import { MessageThread } from './MessageThread';
import { StatusPanel } from './StatusPanel';
import { TrackingLinkCard } from './TrackingLinkCard';

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <h2 id={`${id}-title`} className="font-sans text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: Array<[string, ReactNode | null | undefined]> }) {
  const filled = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[minmax(140px,auto)_1fr]">
      {filled.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-text-subtle">{label}</dt>
          <dd className="break-words whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Message on WhatsApp" (wa.me) and "Call" (tel:) for the customer's phone number. */
function PhoneActions({ phone }: { phone: string }) {
  const { t } = useTranslation('admin');
  const whatsapp = whatsappHref(phone);
  return (
    <div className="flex flex-wrap gap-3">
      {whatsapp ? (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'sm')}>
          <Icon name="chat" size={18} />
          {t('detail.whatsapp')}
        </a>
      ) : null}
      <a href={telHref(phone)} className={buttonClasses('secondary', 'sm')}>
        <Icon name="phone" size={18} />
        {t('detail.call')}
      </a>
    </div>
  );
}

/** Everything about one order for the artist (PROMPT.md §10). */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useAdminOrder(id);

  if (order.isPending) return <LoadingBlock className="min-h-[50vh]" />;
  if (order.isError) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  return <OrderDetail order={order.data} key={order.data.id} />;
}

function OrderDetail({ order }: { order: AdminOrderDetailDto }) {
  const { t } = useTranslation('admin');
  const { t: to } = useTranslation('order');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const archive = useArchiveOrder(order.id);
  const [viewer, setViewer] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { contact, projectAddress: address } = order;

  const images = order.attachments.map((a) => ({
    src: mediaUrl(a.url),
    alt: a.originalName,
    downloadHref: mediaUrl(`${a.url}?download=1`),
  }));
  const budget =
    order.budgetMin !== null || order.budgetMax !== null
      ? [order.budgetMin, order.budgetMax].map((v) => (v === null ? '…' : formatCurrency(v, locale))).join(' – ')
      : null;

  return (
    <>
      <AdminPageHeader
        eyebrow={
          <Link to="/admin/orders" className="inline-flex min-h-11 items-center gap-2 hover:text-text">
            <Icon name="arrowLeft" size={18} />
            {t('detail.back')}
          </Link>
        }
        title={order.reference}
        intro={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} />
            <span>{t('detail.submittedOn', { date: formatDateTime(order.createdAt, locale) })}</span>
            {order.archivedAt ? <span>· {t('detail.archivedOn', { date: formatDate(order.archivedAt, locale) })}</span> : null}
          </span>
        }
        actions={
          order.archivedAt ? null : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {tc('actions.edit')}
            </Button>
          )
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel id="request" title={order.title}>
            {order.inspiration ? (
              <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-accent/50 bg-selected p-3">
                <ArtworkImage src={order.inspiration.imageUrl} alt="" className="size-16 shrink-0" />
                <p>{to('inspiration.inspiredBy', { title: order.inspiration.title })}</p>
              </div>
            ) : null}
            <Facts
              rows={[
                [to('form.service'), order.serviceName],
                [to('form.size'), formatDimensions(order.width, order.height, order.unit, locale)],
                [to('form.description'), order.description],
                // Fields of orders from the former wizard, shown when present.
                [t('detail.customRequest'), order.customRequest],
                [t('detail.changes'), order.additionalSpecs],
                [t('detail.wall'), order.wallWidth !== null || order.wallHeight !== null ? `${order.wallWidth ?? '…'} × ${order.wallHeight ?? '…'} ${order.unit.toLowerCase()}` : null],
                [t('detail.surface'), order.surfaceDetails],
                [t('detail.extra'), order.extraSpecifications],
                [t('detail.style'), order.stylePreferences],
                [t('detail.colors'), order.colorPreferences],
                [t('detail.theme'), order.themePreferences],
                [t('detail.budget'), budget],
                [t('detail.deadline'), order.deadline ? formatCalendarDate(order.deadline, locale) : null],
                [t('detail.instructions'), order.extraInstructions],
                [t('detail.quote'), order.quoteAmount !== null ? formatCurrency(order.quoteAmount, locale) : null],
              ]}
            />
          </Panel>

          <Panel id="photos" title={t('detail.photos', { count: order.attachments.length })}>
            {images.length ? (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((image, index) => (
                  <li key={image.src}>
                    <button
                      type="button"
                      onClick={() => setViewer(index)}
                      aria-label={t('detail.openPhoto', { name: image.alt })}
                      className="block w-full overflow-hidden rounded-[var(--radius-art)] border border-border focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <img src={image.src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">{t('detail.noPhotos')}</p>
            )}
          </Panel>

          <Panel id="messages" title={t('messages.title')}>
            <MessageThread orderId={order.id} hasEmail={!!contact.email} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel id="customer" title={t('detail.customer')}>
            <Facts
              rows={[
                [to('form.fullName'), contact.fullName],
                [to('form.phone'), contact.phone],
                [to('form.email'), contact.email ? <a href={`mailto:${contact.email}`} className="underline underline-offset-4">{contact.email}</a> : t('detail.noEmail')],
                [t('edit.language'), tc(`language.${contact.communicationLocale}`)],
                [
                  to('form.address'),
                  [`${address.street} ${address.houseNumber}`, address.addressExtra, `${address.postalCode} ${address.city}`, address.country]
                    .filter(Boolean)
                    .join('\n'),
                ],
              ]}
            />
            {contact.phone ? <PhoneActions phone={contact.phone} /> : null}
          </Panel>

          <Panel id="status" title={t('status.title')}>
            <StatusPanel order={order} />
            <ol className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 border-l border-border pl-4">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={entry.toStatus} />
                    <span className="text-xs text-text-subtle">
                      {formatDateTime(entry.createdAt, locale)} · {entry.changedByRole === 'ADMIN' ? t('status.byArtist') : t('status.byCustomer')}
                    </span>
                  </span>
                  {entry.quoteAmount !== null ? <span className="text-sm">{formatCurrency(entry.quoteAmount, locale)}</span> : null}
                  {entry.note ? <span className="text-sm whitespace-pre-line text-text-muted">{entry.note}</span> : null}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel id="tracking" title={t('tracking.title')}>
            <TrackingLinkCard orderId={order.id} email={contact.email} />
          </Panel>

          <InternalNotes orderId={order.id} notes={order.internalNotes} />

          {order.canArchive ? (
            <Panel id="archive" title={t('archive.title')}>
              <p className="text-sm text-text-muted">{t('archive.intro')}</p>
              <Button variant="secondary" size="sm" onClick={() => setArchiving(true)} className="self-start">
                {t('archive.submit')}
              </Button>
            </Panel>
          ) : null}
        </div>
      </div>

      <ImageViewer images={images} index={viewer} onIndexChange={setViewer} />
      {editing ? <EditOrderDialog order={order} open onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={() =>
          archive.mutate(undefined, {
            onSuccess: () => {
              setArchiving(false);
              toast.success(t('archive.done'));
            },
            onError: (error) => {
              setArchiving(false);
              toast.error(errorMessage(error));
            },
          })
        }
        loading={archive.isPending}
        title={t('archive.confirmTitle')}
        description={t('archive.confirmBody')}
        confirmLabel={t('archive.submit')}
      />
    </>
  );
}

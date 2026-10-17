import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotificationDto, Role } from '@painter/shared';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { cx } from '../../components/ui/cx';
import { formatRelativeTime } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { useMe } from '../auth/hooks';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from './notification-hooks';
import { useDisclosure } from './useDisclosure';

function notificationHref(notification: NotificationDto, role: Role): string {
  if (!notification.orderId) return role === 'ADMIN' ? '/admin' : '/account/orders';
  return role === 'ADMIN' ? `/admin/orders/${notification.orderId}` : `/account/orders/${notification.orderId}`;
}

/** Bell with unread count; the panel lists recent notifications in the current language. */
export function NotificationsBell() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: user } = useMe();
  const panel = useDisclosure();
  const unread = useUnreadCount(!!user);
  const list = useNotificationList(!!user && panel.open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!user) return null;
  const count = unread.data ?? 0;

  const text = (n: NotificationDto) =>
    t(`notifications.${n.type}`, {
      reference: n.orderReference ?? '',
      status: n.status ? t(`status.${n.status}`) : '',
    });

  return (
    <div className="relative">
      <button
        ref={panel.triggerRef}
        type="button"
        aria-expanded={panel.open}
        aria-controls="notifications-panel"
        aria-label={t('notifications.bell', { count })}
        onClick={panel.toggle}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-text transition-colors hover:bg-surface aria-expanded:bg-surface"
      >
        <Icon name="bell" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-[18px] font-bold text-on-accent"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {panel.open ? (
        <div
          ref={panel.panelRef}
          id="notifications-panel"
          role="region"
          aria-label={t('notifications.title')}
          className="fixed inset-x-4 top-24 z-50 rounded-[var(--radius-card)] border border-border bg-surface-2 shadow-2xl shadow-black/70 sm:absolute sm:inset-x-auto sm:top-[calc(100%+12px)] sm:right-0 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <h2 className="font-sans text-sm font-semibold">{t('notifications.title')}</h2>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className="min-h-11 px-1 text-sm text-text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {t('notifications.markAllRead')}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {list.isPending ? (
              <div className="flex justify-center py-8 text-text-muted" role="status">
                <Spinner />
                <span className="sr-only">{t('labels.loading')}</span>
              </div>
            ) : list.isError ? (
              <p className="px-3 py-6 text-center text-sm text-text-muted">{t('notifications.loadError')}</p>
            ) : list.data.items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-muted">{t('notifications.empty')}</p>
            ) : (
              <ul className="flex flex-col">
                {list.data.items.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={notificationHref(n, user.role)}
                      onClick={() => {
                        if (!n.readAt) markRead.mutate(n.id);
                        panel.close(false);
                      }}
                      className="flex gap-3 rounded-[10px] px-3 py-3 transition-colors hover:bg-surface focus-visible:bg-surface"
                    >
                      <span
                        className={cx('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className={cx('text-sm', n.readAt ? 'text-text-muted' : 'font-semibold text-text')}>
                          {text(n)}
                          {n.readAt ? null : <span className="sr-only"> ({t('notifications.unread')})</span>}
                        </span>
                        <span className="text-xs text-text-subtle">{formatRelativeTime(n.createdAt, locale)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { cx } from '../../../components/ui/cx';
import { useLogout } from '../../auth/hooks';
import { BrandMark } from '../../layout/BrandMark';
import { useAdminStats } from '../hooks';

interface NavItem {
  to: string;
  labelKey: string;
  icon: IconName;
  end?: boolean;
  /** Shows the number of unread customer messages. */
  unread?: boolean;
}

/** Sections of the dashboard. */
const ITEMS: NavItem[] = [
  { to: '/admin', labelKey: 'nav.overview', icon: 'dashboard', end: true },
  { to: '/admin/orders', labelKey: 'nav.orders', icon: 'inbox', unread: true },
  { to: '/admin/catalog', labelKey: 'nav.catalog', icon: 'image' },
  { to: '/admin/categories', labelKey: 'nav.categories', icon: 'tag' },
  { to: '/admin/texts', labelKey: 'nav.texts', icon: 'text' },
  { to: '/admin/settings', labelKey: 'nav.settings', icon: 'settings' },
];

const linkClass = (active: boolean) =>
  cx(
    'flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors',
    active ? 'bg-surface-2 font-semibold text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text',
  );

/** Side menu: brand, sections, then "view site", password and log out at the bottom. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('admin');
  const stats = useAdminStats();
  const logout = useLogout();
  const unread = stats.data?.unreadCustomerMessages ?? 0;

  return (
    <div className="flex h-full flex-col gap-8">
      <Link to="/admin" onClick={onNavigate} className="inline-flex min-h-11 items-center px-3">
        <BrandMark className="text-[28px]" logoClassName="h-9 w-auto max-w-[180px]" />
      </Link>
      <nav aria-label={t('nav.label')}>
        <ul className="flex flex-col gap-1">
          {ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
                <Icon name={item.icon} />
                <span className="flex-1">{t(item.labelKey)}</span>
                {item.unread && unread > 0 ? (
                  <span className="rounded-full bg-accent px-2 text-xs leading-5 font-bold text-on-accent">
                    {unread}
                    <span className="sr-only"> {t('nav.unreadMessages', { count: unread })}</span>
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
        <li>
          <Link to="/" onClick={onNavigate} className={linkClass(false)}>
            <Icon name="external" />
            {t('nav.viewSite')}
          </Link>
        </li>
        <li>
          <NavLink to="/admin/account" onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
            <Icon name="user" />
            {t('nav.account')}
          </NavLink>
        </li>
        <li>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => {
              onNavigate?.();
              logout.mutate();
            }}
            className={cx(linkClass(false), 'w-full text-left')}
          >
            <Icon name="logout" />
            {t('nav.logout')}
          </button>
        </li>
      </ul>
    </div>
  );
}

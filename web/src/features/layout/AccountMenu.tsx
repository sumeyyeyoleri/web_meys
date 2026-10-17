import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';
import { useLogout, useMe } from '../auth/hooks';
import { useDisclosure } from './useDisclosure';

const itemClass =
  'flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm text-text transition-colors hover:bg-surface focus-visible:bg-surface';

/** Login icon for guests; a small account menu for signed-in users. */
export function AccountMenu() {
  const { t } = useTranslation();
  const { data: user, isPending } = useMe();
  const logout = useLogout();
  const menu = useDisclosure();

  if (isPending) return <span className="size-11" aria-hidden="true" />;

  if (!user) {
    return (
      <Link
        to="/login"
        aria-label={t('nav.login')}
        title={t('nav.login')}
        className="inline-flex size-11 items-center justify-center rounded-full text-text transition-colors hover:bg-surface"
      >
        <Icon name="user" />
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        ref={menu.triggerRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls="account-menu"
        aria-label={t('nav.accountMenu')}
        title={t('nav.accountMenu')}
        onClick={menu.toggle}
        className="inline-flex size-11 items-center justify-center rounded-full text-text transition-colors hover:bg-surface aria-expanded:bg-surface"
      >
        <Icon name="user" />
      </button>
      {menu.open ? (
        <div
          ref={menu.panelRef}
          id="account-menu"
          className="absolute top-[calc(100%+12px)] right-0 z-50 w-64 rounded-[var(--radius-card)] border border-border bg-surface-2 p-2 shadow-2xl shadow-black/70"
        >
          <p className="truncate px-3 py-2 text-xs text-text-subtle">{t('nav.signedInAs', { email: user.email })}</p>
          <ul className="flex flex-col">
            {user.role === 'ADMIN' ? (
              <li>
                <Link to="/admin" className={itemClass} onClick={() => menu.close(false)}>
                  {t('nav.admin')}
                </Link>
              </li>
            ) : (
              <li>
                <Link to="/account/orders" className={itemClass} onClick={() => menu.close(false)}>
                  {t('nav.myOrders')}
                </Link>
              </li>
            )}
            <li>
              <Link to="/account/profile" className={itemClass} onClick={() => menu.close(false)}>
                {t('nav.profile')}
              </Link>
            </li>
            <li className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                className={itemClass}
                disabled={logout.isPending}
                onClick={() => {
                  menu.close(false);
                  logout.mutate();
                }}
              >
                {t('nav.logout')}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

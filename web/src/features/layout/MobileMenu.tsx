import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buttonClasses } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { useLogout, useMe } from '../auth/hooks';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NAV_LINKS } from './nav-links';

/** Full-screen dark sheet with large serif links (focus trapped by the modal dialog, Esc closes). */
export function MobileMenu({ open, onClose, businessName }: { open: boolean; onClose: () => void; businessName: string }) {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  const secondary = 'inline-flex min-h-11 items-center text-lg text-text-muted hover:text-text';

  return (
    <Dialog open={open} onClose={onClose} title={businessName || t('nav.main')} variant="sheet">
      <div className="flex min-h-[calc(100dvh-140px)] flex-col">
        <nav aria-label={t('nav.main')} className="mt-6">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cx('inline-flex min-h-14 items-center font-display text-[40px] leading-none', isActive ? 'text-text' : 'text-text-muted')
                  }
                >
                  {t(link.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Link to="/order" onClick={onClose} className={buttonClasses('primary', 'md', 'mt-8 self-start')}>
          <Icon name="plane" size={18} />
          {t('nav.order')}
        </Link>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-6">
          {user ? (
            <>
              <Link to={user.role === 'ADMIN' ? '/admin' : '/account/orders'} onClick={onClose} className={secondary}>
                {user.role === 'ADMIN' ? t('nav.admin') : t('nav.myOrders')}
              </Link>
              <Link to="/account/profile" onClick={onClose} className={secondary}>
                {t('nav.profile')}
              </Link>
              <button
                type="button"
                className={cx(secondary, 'text-left')}
                onClick={() => {
                  onClose();
                  logout.mutate();
                }}
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <Link to="/login" onClick={onClose} className={secondary}>
              {t('nav.login')}
            </Link>
          )}
          <div className="mt-2 flex items-center gap-3">
            <Icon name="globe" className="text-text-subtle" />
            <LanguageSwitcher size="lg" />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

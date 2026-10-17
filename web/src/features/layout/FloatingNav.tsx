import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buttonClasses, IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { useSite } from '../public/hooks';
import { AccountMenu } from './AccountMenu';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileMenu } from './MobileMenu';
import { NAV_LINKS } from './nav-links';
import { NotificationsBell } from './NotificationsBell';

/** Centered floating pill navigation (FRONTEND_DESIGN.md §3). */
export function FloatingNav() {
  const { t } = useTranslation();
  const { data: site } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const businessName = site?.settings.businessName ?? '';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 px-4 sm:top-7">
      <div
        className={cx(
          'pointer-events-auto mx-auto flex h-16 max-w-[760px] items-center gap-2 rounded-2xl border bg-surface-2 pr-2 pl-5 transition-[background-color,border-color,box-shadow] duration-500',
          scrolled ? 'border-border-strong bg-surface-2/95 shadow-2xl shadow-black/70 backdrop-blur-md' : 'border-border',
        )}
      >
        <Link to="/" className="mr-auto min-w-0 truncate font-display text-[22px] leading-none text-text">
          {businessName || <span className="sr-only">{t('nav.home')}</span>}
        </Link>

        <nav aria-label={t('nav.main')} className="hidden lg:block">
          <ul className="flex items-center">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex min-h-11 items-center px-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors duration-300',
                      isActive ? 'text-text' : 'text-text-muted hover:text-text',
                    )
                  }
                >
                  {t(link.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center lg:flex">
          <LanguageSwitcher />
          <NotificationsBell />
          <AccountMenu />
          <Link to="/order" className={buttonClasses('secondary', 'sm', 'ml-1 min-h-11 gap-1.5 px-4')}>
            <Icon name="plane" size={16} />
            {t('nav.order')}
          </Link>
        </div>

        <div className="flex items-center lg:hidden">
          <NotificationsBell />
          <IconButton label={t('nav.openMenu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </IconButton>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} businessName={businessName} />
    </header>
  );
}

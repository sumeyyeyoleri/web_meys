import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RequireAdmin } from '../../../app/guards';
import { IconButton } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { setLocale } from '../../../lib/i18n';
import { useMe } from '../../auth/hooks';
import { BrandMark } from '../../layout/BrandMark';
import { LanguageSwitcher } from '../../layout/LanguageSwitcher';
import { useSetAdminLocale } from '../hooks';
import { AdminNav } from './AdminNav';
import { NotificationsBell } from './NotificationsBell';

/**
 * The dashboard's own layout, separate from the public site: side menu on the left, content on
 * the right; on phones the menu becomes a full-screen sheet (PROMPT.md §17).
 */
export function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminShell />
    </RequireAdmin>
  );
}

function AdminShell() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const setAdminLocale = useSetAdminLocale();
  const { data: user } = useMe();
  const preferred = user?.preferredLocale;

  // The dashboard opens in the artist's own language (Turkish by default), whatever the site showed.
  useEffect(() => {
    if (preferred) void setLocale(preferred);
  }, [preferred]);

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#admin-main"
        className="fixed top-2 left-2 z-[70] -translate-y-24 rounded-full bg-accent px-5 py-3 font-semibold text-on-accent focus-visible:translate-y-0"
      >
        {tc('skipToContent')}
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))] lg:block">
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="safe-x sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-bg/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-8">
          <div className="flex h-16 flex-1 items-center gap-2">
            <IconButton label={t('nav.openMenu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="-ml-2 lg:hidden">
              <Icon name="menu" />
            </IconButton>
            <span className="mr-auto lg:hidden">
              <BrandMark className="text-[22px]" logoClassName="h-7 w-auto max-w-[140px]" />
            </span>
            <span className="mr-auto hidden text-sm text-text-subtle lg:block">{t('meta.title')}</span>
            <LanguageSwitcher allLocales onSelect={(locale) => setAdminLocale.mutate(locale)} />
            <NotificationsBell />
          </div>
        </header>
        <main
          id="admin-main"
          tabIndex={-1}
          className="safe-x flex-1 px-4 pt-6 pb-[calc(32px+env(safe-area-inset-bottom))] focus-visible:outline-none sm:px-8 lg:px-10 lg:pt-8"
        >
          <Outlet />
        </main>
      </div>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={t('nav.label')} variant="sheet" hideTitle>
        <div className="min-h-[calc(100dvh-140px)]">
          <AdminNav onNavigate={() => setMenuOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}

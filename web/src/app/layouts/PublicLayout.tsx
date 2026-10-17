import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FloatingNav } from '../../features/layout/FloatingNav';
import { Footer } from '../../features/layout/Footer';

export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="fixed top-2 left-2 z-[70] -translate-y-24 rounded-full bg-accent px-5 py-3 font-semibold text-on-accent focus-visible:translate-y-0"
      >
        {t('skipToContent')}
      </a>
      <FloatingNav />
      <main id="main" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

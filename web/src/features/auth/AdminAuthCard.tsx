import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../layout/BrandMark';

/**
 * The artist's sign-in screens (PROMPT.md §18.3): dark, the logo centred, title "Dashboard".
 * Rendered without the public navigation; customers never need these pages.
 */
export function AdminAuthCard({ heading, intro, children, footer }: { heading?: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation('account');
  return (
    <main
      id="main"
      className="safe-x flex min-h-dvh items-center justify-center bg-bg px-4 pt-[calc(48px+env(safe-area-inset-top))] pb-[calc(48px+env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col items-center gap-5 text-center">
          <Link to="/" aria-label={t('admin.toSite')} className="inline-flex min-h-11 items-center">
            <BrandMark className="text-5xl" logoClassName="h-14 w-auto max-w-[240px]" />
          </Link>
          <h1 className="text-4xl">{heading ?? t('admin.title')}</h1>
          {intro ? <p className="text-text-muted">{intro}</p> : null}
        </header>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">{children}</div>
        {footer ? <div className="text-center text-text-muted">{footer}</div> : null}
      </div>
    </main>
  );
}

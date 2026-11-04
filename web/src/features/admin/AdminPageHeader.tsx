import type { ReactNode } from 'react';
import { usePageTitle } from '../../lib/use-page-title';

/** Page title (also the browser tab title), optional intro and actions on the right. */
export function AdminPageHeader({ title, intro, actions, eyebrow }: { title: string; intro?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  usePageTitle(title);
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow ? <div className="text-sm text-text-muted">{eyebrow}</div> : null}
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {intro ? <p className="text-text-muted">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

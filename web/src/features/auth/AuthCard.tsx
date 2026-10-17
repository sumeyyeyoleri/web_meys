import type { ReactNode } from 'react';

/** Centered dark panel used by all authentication pages. */
export function AuthCard({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-content flex justify-center pt-32 pb-24 sm:pt-40">
      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col gap-3 text-center">
          <h1 className="text-5xl">{title}</h1>
          {intro ? <p className="text-text-muted">{intro}</p> : null}
        </header>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">{children}</div>
        {footer ? <div className="text-center text-text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

/** Inline message at the top of a form (errors are announced immediately). */
export function FormAlert({ tone = 'error', children, className }: { tone?: 'error' | 'success' | 'info'; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex gap-3 rounded-[var(--radius-field)] border p-4 text-[15px]',
        tone === 'error' && 'border-status-red/50 bg-status-red/10',
        tone === 'success' && 'border-status-green/50 bg-status-green/10',
        tone === 'info' && 'border-border-strong bg-surface-2',
        className,
      )}
    >
      <Icon
        name={tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info'}
        className={cx('mt-0.5 shrink-0', tone === 'error' ? 'text-status-red' : tone === 'success' ? 'text-status-green' : 'text-text-muted')}
      />
      <div className="flex-1 text-text">{children}</div>
    </div>
  );
}

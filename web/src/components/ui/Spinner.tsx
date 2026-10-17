import { useTranslation } from 'react-i18next';
import { cx } from './cx';

export function Spinner({ size = 20, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx('animate-spin', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Centered loading state for a page or panel. */
export function LoadingBlock({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cx('flex min-h-40 items-center justify-center text-text-muted', className)} role="status">
      <Spinner size={28} />
      <span className="sr-only">{t('labels.loading')}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-[var(--radius-art)] bg-surface-2', className)} aria-hidden="true" />;
}

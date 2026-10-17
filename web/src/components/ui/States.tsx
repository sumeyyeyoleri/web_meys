import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../../lib/api';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

export function EmptyState({
  icon = 'image',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="text-2xl">{title}</h3>
      {description ? <p className="max-w-md text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Translated message for any error thrown by the API client. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (isApiError(error)) return t(`errors.${error.code}`, { defaultValue: t('errors.generic') });
    return t('errors.generic');
  };
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  const message = useErrorMessage()(error);
  return (
    <div
      role="alert"
      className={cx('flex flex-col items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface px-6 py-10 text-center', className)}
    >
      <Icon name="alert" size={24} className="text-status-red" />
      <p className="text-text">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </div>
  );
}

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderStatus } from '@painter/shared';
import { cx } from './cx';

type Tone = 'amber' | 'green' | 'blue' | 'red' | 'neutral' | 'accent';

const tones: Record<Tone, { dot: string; text: string }> = {
  amber: { dot: 'bg-status-amber', text: 'text-status-amber' },
  green: { dot: 'bg-status-green', text: 'text-status-green' },
  blue: { dot: 'bg-status-blue', text: 'text-status-blue' },
  red: { dot: 'bg-status-red', text: 'text-status-red' },
  neutral: { dot: 'bg-status-neutral', text: 'text-text-muted' },
  accent: { dot: 'bg-accent', text: 'text-accent' },
};

/** Small pill with a coloured dot; colour is never the only signal (always has a text label). */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        tones[tone].text,
        className,
      )}
    >
      <span className={cx('size-1.5 rounded-full', tones[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

const STATUS_TONES: Record<OrderStatus, Tone> = {
  SUBMITTED: 'amber',
  UNDER_REVIEW: 'blue',
  AWAITING_CUSTOMER_INFO: 'amber',
  QUOTE_SENT: 'accent',
  ACCEPTED: 'green',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge tone={STATUS_TONES[status]} className={className}>
      {t(`status.${status}`)}
    </Badge>
  );
}

/** "Example" label for sample portfolio items. */
export function SampleBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border border-border-strong bg-bg/80 px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-text uppercase backdrop-blur-sm',
        className,
      )}
    >
      {t('labels.example')}
    </span>
  );
}

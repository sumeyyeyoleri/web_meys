import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidationMessage } from '../../lib/i18n';
import { Icon } from './Icon';
import { cx } from './cx';

export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
  'aria-required': boolean | undefined;
}

interface FieldProps {
  label: ReactNode;
  /** Validation key (e.g. `validation.required`) or an already translated message. */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label above, helper text, error with icon — all wired with aria-describedby. */
export function Field({ label, error, hint, required, optional, className, children }: FieldProps) {
  const { t } = useTranslation();
  const translate = useValidationMessage();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const message = error?.startsWith('validation.') ? translate(error) : error;

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-text-subtle">({t('labels.optional')})</span> : null}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {message ? <FieldError id={errorId}>{message}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-status-red">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export const controlClasses =
  'w-full min-h-12 rounded-[var(--radius-field)] border border-border-strong bg-surface px-4 py-3 text-base text-text placeholder:text-text-subtle transition-colors duration-300 hover:border-text-subtle focus-visible:border-accent aria-[invalid=true]:border-status-red disabled:opacity-60';

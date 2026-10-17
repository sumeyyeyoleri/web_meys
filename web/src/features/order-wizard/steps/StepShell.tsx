import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';

interface StepShellProps {
  title: string;
  intro?: ReactNode;
  onSubmit: (event: FormEvent) => void;
  onBack?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  children: ReactNode;
}

/** Step layout: heading (focused when the step appears), fields, back/next buttons. */
export function StepShell({ title, intro, onSubmit, onBack, submitLabel, submitting, submitDisabled, children }: StepShellProps) {
  const { t } = useTranslation('order');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Move focus to the new step so keyboard and screen reader users start at the top.
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-4xl focus-visible:outline-none sm:text-5xl">
          {title}
        </h2>
        {intro ? <p className="text-text-muted">{intro}</p> : null}
      </header>
      {children}
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button variant="secondary" onClick={onBack} disabled={submitting}>
            <Icon name="arrowLeft" size={18} />
            {t('nav.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={submitting} disabled={submitDisabled}>
          {submitLabel ?? t('nav.next')}
          {submitLabel ? null : <Icon name="arrowRight" size={18} />}
        </Button>
      </div>
    </form>
  );
}

/** Shows errors returned by the server (or the final full validation) on this step's fields. */
export function useServerErrors<T extends FieldValues>(form: UseFormReturn<T, unknown, unknown>, errors?: Record<string, string>) {
  useEffect(() => {
    if (!errors) return;
    let first = true;
    for (const [path, key] of Object.entries(errors)) {
      form.setError(path as Path<T>, { type: 'server', message: key }, { shouldFocus: first });
      first = false;
    }
  }, [errors, form]);
}

export interface StepProps<T> {
  values: T;
  onNext: (values: T) => void;
  onBack?: (values: T) => void;
  serverErrors?: Record<string, string>;
}

import { useTranslation } from 'react-i18next';

/** "What happens next?" on the confirmation page; messages are read through the tracking link. */
export function NextSteps() {
  const { t } = useTranslation('order');
  const steps = [t('confirmation.next1'), t('confirmation.next2'), t('confirmation.next3')];
  return (
    <section aria-labelledby="next-title" className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
      <h2 id="next-title" className="mb-5 text-3xl">
        {t('confirmation.nextTitle')}
      </h2>
      <ol className="flex flex-col gap-4">
        {steps.map((text, i) => (
          <li key={i} className="flex gap-4">
            <span className="font-display text-3xl leading-none text-accent" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-text-muted">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

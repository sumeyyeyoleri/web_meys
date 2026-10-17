import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { reviewStepSchema, type PortfolioItemDto, type ServiceDto } from '@painter/shared';
import type { z } from 'zod';
import { FieldError } from '../../../components/ui/Field';
import { Checkbox } from '../../../components/ui/Inputs';
import { useValidationMessage } from '../../../lib/i18n';
import { ArtworkImage } from '../../public/ArtworkImage';
import { useSummaryFormat } from '../summary-format';
import type { StepKey, WizardFile, WizardValues } from '../wizard-model';
import { StepShell, useServerErrors } from './StepShell';

interface ReviewStepProps {
  values: WizardValues;
  files: WizardFile[];
  services: ServiceDto[] | undefined;
  inspiration: PortfolioItemDto | null;
  serverErrors?: Record<string, string>;
  submitting: boolean;
  submitDisabled: boolean;
  onEdit: (step: StepKey) => void;
  onBack: () => void;
  onSubmit: (privacyAccepted: boolean) => void;
}

function Section({ step, title, onEdit, children }: { step: StepKey; title: string; onEdit: (s: StepKey) => void; children: ReactNode }) {
  const { t } = useTranslation('order');
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-sans text-base font-semibold">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          aria-label={t('review.editStep', { step: title })}
          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-text-muted underline-offset-4 hover:text-text hover:underline"
        >
          {t('review.edit')}
        </button>
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string | undefined]> }) {
  const filled = rows.filter(([, value]) => value && value.trim());
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[minmax(140px,auto)_1fr]">
      {filled.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-text-subtle">{label}</dt>
          <dd className="whitespace-pre-line text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewStep({ values, files, services, inspiration, serverErrors, submitting, submitDisabled, onEdit, onBack, onSubmit }: ReviewStepProps) {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  const translate = useValidationMessage();
  const format = useSummaryFormat();
  const form = useForm<z.input<typeof reviewStepSchema>, unknown, z.output<typeof reviewStepSchema>>({
    resolver: zodResolver(reviewStepSchema),
    defaultValues: { privacyAccepted: values.privacyAccepted as true },
  });
  useServerErrors(form, serverErrors);
  const privacyError = form.formState.errors.privacyAccepted?.message;
  const s = (value: unknown) => (typeof value === 'string' ? value : undefined);
  const { service, dimensions: dim, details, contact } = values;

  return (
    <StepShell
      title={t('review.title')}
      intro={t('review.intro')}
      onSubmit={form.handleSubmit(() => onSubmit(true))}
      onBack={onBack}
      submitLabel={submitting ? t('nav.submitting') : t('nav.submit')}
      submitting={submitting}
      submitDisabled={submitDisabled}
    >
      <Section step="service" title={t('steps.service')} onEdit={onEdit}>
        <Rows
          rows={[
            [t('summary.service'), format.service(service, services)],
            [t('summary.inspiration'), inspiration?.title],
            [t('review.changes'), inspiration ? service.additionalSpecs : undefined],
            [t('review.customRequest'), service.customRequest],
          ]}
        />
      </Section>
      <Section step="dimensions" title={t('steps.dimensions')} onEdit={onEdit}>
        <Rows
          rows={[
            [t('summary.dimensions'), format.dimensions(dim)],
            [t('review.wall'), format.wall(dim)],
            [t('dimensions.surface'), s(dim.surfaceDetails)],
            [t('dimensions.extra'), s(dim.extraSpecifications)],
          ]}
        />
      </Section>
      <Section step="references" title={t('steps.references')} onEdit={onEdit}>
        {files.length || inspiration ? (
          <ul className="flex flex-wrap gap-3">
            {inspiration ? (
              <li>
                <ArtworkImage src={inspiration.imageUrl} alt={`${t('inspiration.fromCatalog')}: ${inspiration.title}`} className="size-20 ring-1 ring-accent" />
              </li>
            ) : null}
            {files.map((f) => (
              <li key={f.id}>
                <img src={f.previewUrl} alt={f.file.name} className="size-20 rounded-[var(--radius-art)] object-cover" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-subtle">{t('summary.referencesCount', { count: 0 })}</p>
        )}
      </Section>
      <Section step="details" title={t('steps.details')} onEdit={onEdit}>
        <Rows
          rows={[
            [t('details.projectTitle'), s(details.title)],
            [t('details.description'), s(details.description)],
            [t('details.style'), s(details.stylePreferences)],
            [t('details.color'), s(details.colorPreferences)],
            [t('details.theme'), s(details.themePreferences)],
            [t('summary.budget'), format.budget(details)],
            [t('summary.deadline'), format.deadline(details)],
            [t('details.extra'), s(details.extraInstructions)],
          ]}
        />
      </Section>
      <Section step="contact" title={t('steps.contact')} onEdit={onEdit}>
        <Rows
          rows={[
            [t('contact.fullName'), contact.fullName],
            [t('contact.email'), contact.email],
            [t('contact.phone'), contact.phone],
            [
              t('contact.addressTitle'),
              [`${contact.street} ${contact.houseNumber}`, s(contact.addressExtra), `${contact.postalCode} ${contact.city}`, contact.country]
                .filter((part): part is string => !!part?.trim())
                .join('\n'),
            ],
            [t('contact.communicationLocale'), tc(`language.${contact.communicationLocale}`)],
          ]}
        />
      </Section>

      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border-strong p-5">
        <Checkbox
          id="privacy-accepted"
          label={t('review.privacy')}
          aria-invalid={privacyError ? true : undefined}
          aria-describedby={privacyError ? 'privacy-error' : undefined}
          {...form.register('privacyAccepted')}
        />
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="ml-8 inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
          {t('review.privacyLink')}
          <span className="sr-only"> {tc('labels.opensInNewTab')}</span>
        </a>
        {privacyError ? <FieldError id="privacy-error">{translate(privacyError)}</FieldError> : null}
      </div>
      <p className="text-sm text-text-muted">{t('summary.noCharge')}</p>
    </StepShell>
  );
}

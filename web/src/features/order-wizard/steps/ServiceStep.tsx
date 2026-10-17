import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { serviceStepSchema, type PortfolioItemDto, type ServiceDto } from '@painter/shared';
import type { z } from 'zod';
import { Badge } from '../../../components/ui/Badge';
import { Field, FieldError } from '../../../components/ui/Field';
import { ChoiceCard, Textarea } from '../../../components/ui/Inputs';
import { Skeleton } from '../../../components/ui/Spinner';
import { useValidationMessage } from '../../../lib/i18n';
import { ArtworkImage } from '../../public/ArtworkImage';
import { InspirationBanner } from '../InspirationBanner';
import type { ServiceValues } from '../wizard-model';
import { StepShell, useServerErrors, type StepProps } from './StepShell';

type Values = z.input<typeof serviceStepSchema>;

interface ServiceStepProps extends StepProps<ServiceValues> {
  services: ServiceDto[] | undefined;
  servicesError: boolean;
  inspiration: PortfolioItemDto | null;
  inspirationServiceMatched: boolean;
  onRemoveInspiration: () => void;
}

export function ServiceStep({
  values,
  onNext,
  serverErrors,
  services,
  servicesError,
  inspiration,
  inspirationServiceMatched,
  onRemoveInspiration,
}: ServiceStepProps) {
  const { t } = useTranslation('order');
  const translate = useValidationMessage();
  const form = useForm<Values, unknown, z.output<typeof serviceStepSchema>>({
    resolver: zodResolver(serviceStepSchema),
    defaultValues: { ...values, inspirationItemId: inspiration?.id ?? '' },
  });
  useServerErrors(form, serverErrors);
  const { errors } = form.formState;
  const serviceError = errors.serviceId?.message;

  return (
    <StepShell
      title={t('service.title')}
      intro={t('service.intro')}
      onSubmit={form.handleSubmit(() => {
        const raw = form.getValues();
        const text = (value: unknown) => (typeof value === 'string' ? value : '');
        onNext({ serviceId: text(raw.serviceId), customRequest: text(raw.customRequest), additionalSpecs: text(raw.additionalSpecs) });
      })}
    >
      {inspiration ? (
        <div className="flex flex-col gap-4">
          <InspirationBanner item={inspiration} serviceMatched={inspirationServiceMatched} onRemove={onRemoveInspiration} />
          <Field label={t('inspiration.changesLabel')} hint={t('inspiration.changesHint')} error={errors.additionalSpecs?.message} optional>
            {(p) => <Textarea {...p} rows={3} {...form.register('additionalSpecs')} />}
          </Field>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-3" aria-describedby={serviceError ? 'service-error' : undefined}>
        <legend className="mb-3 text-sm font-semibold">{t('service.options')}</legend>
        {servicesError ? <p className="text-text-muted">{t('service.loadError')}</p> : null}
        {!services && !servicesError ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services?.map((service) => (
              <ChoiceCard
                key={service.id}
                id={`service-${service.id}`}
                value={service.id}
                {...form.register('serviceId')}
                title={service.name}
                description={
                  <>
                    {service.description ? <span className="line-clamp-2">{service.description}</span> : null}
                    {service.isWallService ? <Badge className="mt-2">{t('service.wall')}</Badge> : null}
                  </>
                }
                media={
                  service.imageUrl ? (
                    <ArtworkImage src={service.imageUrl} alt="" className="hidden size-16 shrink-0 sm:block" />
                  ) : undefined
                }
              />
            ))}
            <ChoiceCard
              id="service-none"
              value=""
              {...form.register('serviceId')}
              title={t('service.noneTitle')}
              description={t('service.noneDescription')}
            />
          </div>
        )}
        {serviceError ? <FieldError id="service-error">{translate(serviceError)}</FieldError> : null}
      </fieldset>

      <Field label={t('service.customLabel')} hint={t('service.customHint')} error={errors.customRequest?.message}>
        {(p) => <Textarea {...p} rows={4} {...form.register('customRequest')} />}
      </Field>
    </StepShell>
  );
}

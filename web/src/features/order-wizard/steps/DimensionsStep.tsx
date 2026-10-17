import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DIMENSION_UNITS, dimensionsStepSchema, type DimensionsStepInput } from '@painter/shared';
import type { z } from 'zod';
import { Field } from '../../../components/ui/Field';
import { Input, Select, Textarea } from '../../../components/ui/Inputs';
import { StepShell, useServerErrors, type StepProps } from './StepShell';

/** Decimal fields use a text keyboard with decimals so "2,5" (Belgian notation) works everywhere. */
const decimal = { type: 'text', inputMode: 'decimal' as const, autoComplete: 'off' };

export function DimensionsStep({ values, onNext, onBack, serverErrors, isWallService }: StepProps<DimensionsStepInput> & { isWallService: boolean }) {
  const { t } = useTranslation('order');
  const form = useForm<DimensionsStepInput, unknown, z.output<typeof dimensionsStepSchema>>({
    resolver: zodResolver(dimensionsStepSchema),
    defaultValues: values,
  });
  useServerErrors(form, serverErrors);
  const { errors } = form.formState;

  return (
    <StepShell
      title={t('dimensions.title')}
      intro={t('dimensions.intro')}
      onSubmit={form.handleSubmit(() => onNext(form.getValues()))}
      onBack={() => onBack?.(form.getValues())}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t('dimensions.width')} error={errors.width?.message} required>
          {(p) => <Input {...p} {...decimal} {...form.register('width')} />}
        </Field>
        <Field label={t('dimensions.height')} error={errors.height?.message} required>
          {(p) => <Input {...p} {...decimal} {...form.register('height')} />}
        </Field>
        <Field label={t('dimensions.unit')} error={errors.unit?.message} required>
          {(p) => (
            <Select {...p} {...form.register('unit')}>
              {DIMENSION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {t(`dimensions.unit${unit}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {isWallService ? (
        <fieldset className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <legend className="px-1 text-sm font-semibold">{t('dimensions.wallTitle')}</legend>
          <p className="-mt-2 text-sm text-text-muted">{t('dimensions.wallIntro')}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('dimensions.wallWidth')} error={errors.wallWidth?.message} optional>
              {(p) => <Input {...p} {...decimal} {...form.register('wallWidth')} />}
            </Field>
            <Field label={t('dimensions.wallHeight')} error={errors.wallHeight?.message} optional>
              {(p) => <Input {...p} {...decimal} {...form.register('wallHeight')} />}
            </Field>
          </div>
          <Field label={t('dimensions.surface')} hint={t('dimensions.surfaceHint')} error={errors.surfaceDetails?.message} optional>
            {(p) => <Textarea {...p} rows={2} {...form.register('surfaceDetails')} />}
          </Field>
        </fieldset>
      ) : null}

      <Field label={t('dimensions.extra')} hint={t('dimensions.extraHint')} error={errors.extraSpecifications?.message} optional>
        {(p) => <Textarea {...p} rows={3} {...form.register('extraSpecifications')} />}
      </Field>
    </StepShell>
  );
}

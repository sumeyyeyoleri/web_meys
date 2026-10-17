import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { buildDetailsStepSchema, todayIsoDate, type DetailsStepInput } from '@painter/shared';
import type { z } from 'zod';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Inputs';
import { VALIDATION_PARAMS } from '../../../lib/i18n';
import { StepShell, useServerErrors, type StepProps } from './StepShell';

interface DetailsStepProps extends StepProps<DetailsStepInput> {
  budgetRequired: boolean;
  deadlineRequired: boolean;
}

export function DetailsStep({ values, onNext, onBack, serverErrors, budgetRequired, deadlineRequired }: DetailsStepProps) {
  const { t } = useTranslation('order');
  const schema = useMemo(() => buildDetailsStepSchema({ budgetRequired, deadlineRequired }), [budgetRequired, deadlineRequired]);
  const form = useForm<DetailsStepInput, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: values });
  useServerErrors(form, serverErrors);
  const { errors } = form.formState;
  const money = { type: 'text', inputMode: 'decimal' as const, autoComplete: 'off' };

  return (
    <StepShell
      title={t('details.title')}
      intro={t('details.intro')}
      onSubmit={form.handleSubmit(() => onNext(form.getValues()))}
      onBack={() => onBack?.(form.getValues())}
    >
      <Field label={t('details.projectTitle')} hint={t('details.projectTitleHint')} error={errors.title?.message} required>
        {(p) => <Input {...p} {...form.register('title')} />}
      </Field>
      <Field label={t('details.description')} hint={t('details.descriptionHint', VALIDATION_PARAMS)} error={errors.description?.message} required>
        {(p) => <Textarea {...p} rows={6} {...form.register('description')} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t('details.style')} error={errors.stylePreferences?.message} optional>
          {(p) => <Input {...p} placeholder={t('details.stylePlaceholder')} {...form.register('stylePreferences')} />}
        </Field>
        <Field label={t('details.color')} error={errors.colorPreferences?.message} optional>
          {(p) => <Input {...p} placeholder={t('details.colorPlaceholder')} {...form.register('colorPreferences')} />}
        </Field>
        <Field label={t('details.theme')} error={errors.themePreferences?.message} optional>
          {(p) => <Input {...p} placeholder={t('details.themePlaceholder')} {...form.register('themePreferences')} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold">{t('details.budgetTitle')}</legend>
        <p className="text-sm text-text-muted">{t('details.budgetHint')}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('details.budgetMin')} error={errors.budgetMin?.message} required={budgetRequired} optional={!budgetRequired}>
            {(p) => <Input {...p} {...money} {...form.register('budgetMin')} />}
          </Field>
          <Field label={t('details.budgetMax')} error={errors.budgetMax?.message} required={budgetRequired} optional={!budgetRequired}>
            {(p) => <Input {...p} {...money} {...form.register('budgetMax')} />}
          </Field>
        </div>
      </fieldset>

      <Field
        label={t('details.deadline')}
        hint={t('details.deadlineHint')}
        error={errors.deadline?.message}
        required={deadlineRequired}
        optional={!deadlineRequired}
        className="sm:max-w-xs"
      >
        {(p) => <Input {...p} type="date" min={todayIsoDate()} {...form.register('deadline')} />}
      </Field>
      <Field label={t('details.extra')} error={errors.extraInstructions?.message} optional>
        {(p) => <Textarea {...p} rows={3} {...form.register('extraInstructions')} />}
      </Field>
    </StepShell>
  );
}

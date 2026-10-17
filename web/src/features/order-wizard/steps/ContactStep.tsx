import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { buildContactStepSchema, LOCALES, type ContactStepInput, type UserDto } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Input, Select } from '../../../components/ui/Inputs';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { VALIDATION_PARAMS } from '../../../lib/i18n';
import { StepShell, useServerErrors, type StepProps } from './StepShell';

interface ContactStepProps extends StepProps<ContactStepInput> {
  user: UserDto | null;
  accountExists: boolean;
  /** Opens the inline login; receives the values typed so far so they are kept. */
  onLoginRequest: (values: ContactStepInput) => void;
}

export function ContactStep({ values, onNext, onBack, serverErrors, user, accountExists, onLoginRequest }: ContactStepProps) {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  const { t: ta } = useTranslation('account');
  const isGuest = !user;
  const schema = useMemo(() => buildContactStepSchema(isGuest), [isGuest]);
  const form = useForm<ContactStepInput, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: values });
  useServerErrors(form, serverErrors);
  const { errors } = form.formState;
  const r = form.register;

  return (
    <StepShell
      title={t('contact.title')}
      intro={t('contact.intro')}
      onSubmit={form.handleSubmit(() => onNext(form.getValues()))}
      onBack={() => onBack?.(form.getValues())}
      submitDisabled={user?.role === 'ADMIN'}
    >
      {user?.role === 'ADMIN' ? <FormAlert>{t('contact.adminNotAllowed')}</FormAlert> : null}
      {user && user.role !== 'ADMIN' ? <FormAlert tone="info">{t('contact.signedInAs', { email: user.email })}</FormAlert> : null}
      {isGuest && accountExists ? (
        <FormAlert>
          <p>{t('contact.accountExists')}</p>
          <Button size="sm" className="mt-3" onClick={() => onLoginRequest(form.getValues())}>
            {t('contact.loginInline')}
          </Button>
        </FormAlert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('contact.fullName')} error={errors.fullName?.message} required className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="name" {...r('fullName')} />}
        </Field>
        <Field label={t('contact.email')} error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...r('email')} />}
        </Field>
        <Field label={t('contact.phone')} hint={t('contact.phoneHint')} error={errors.phone?.message} required>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...r('phone')} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 text-sm font-semibold">{t('contact.addressTitle')}</legend>
        <p className="text-sm text-text-muted">{t('contact.addressHint')}</p>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label={t('contact.street')} error={errors.street?.message} required>
            {(p) => <Input {...p} autoComplete="address-line1" {...r('street')} />}
          </Field>
          <Field label={t('contact.houseNumber')} error={errors.houseNumber?.message} required>
            {(p) => <Input {...p} {...r('houseNumber')} />}
          </Field>
          <Field label={t('contact.city')} error={errors.city?.message} required>
            {(p) => <Input {...p} autoComplete="address-level2" {...r('city')} />}
          </Field>
          <Field label={t('contact.postalCode')} error={errors.postalCode?.message} required>
            {(p) => <Input {...p} autoComplete="postal-code" {...r('postalCode')} />}
          </Field>
          <Field label={t('contact.country')} error={errors.country?.message} required>
            {(p) => <Input {...p} autoComplete="country-name" {...r('country')} />}
          </Field>
          <Field label={t('contact.addressExtra')} error={errors.addressExtra?.message} optional>
            {(p) => <Input {...p} autoComplete="address-line2" {...r('addressExtra')} />}
          </Field>
        </div>
      </fieldset>

      <Field label={t('contact.communicationLocale')} error={errors.communicationLocale?.message} className="sm:max-w-xs">
        {(p) => (
          <Select {...p} {...r('communicationLocale')}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {tc(`language.${l}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {isGuest ? (
        <fieldset className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <legend className="px-1 text-sm font-semibold">{t('contact.accountTitle')}</legend>
          <p className="-mt-2 text-sm text-text-muted">{t('contact.accountIntro')}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('contact.password')} hint={ta('fields.passwordHint', VALIDATION_PARAMS)} error={errors.password?.message} required>
              {(p) => <PasswordInput {...p} autoComplete="new-password" {...r('password')} />}
            </Field>
            <Field label={t('contact.passwordConfirm')} error={errors.passwordConfirm?.message} required>
              {(p) => <PasswordInput {...p} autoComplete="new-password" {...r('passwordConfirm')} />}
            </Field>
          </div>
          <p className="text-sm text-text-muted">
            {t('contact.haveAccount')}{' '}
            <button type="button" onClick={() => onLoginRequest(form.getValues())} className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
              {t('contact.loginInline')}
            </button>
          </p>
        </fieldset>
      ) : null}
    </StepShell>
  );
}

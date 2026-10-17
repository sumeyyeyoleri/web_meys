import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, registerSchema } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input, Select } from '../../components/ui/Inputs';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useErrorMessage } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { applyApiFieldErrors, safeNextPath } from '../../lib/form-errors';
import { useLocale, VALIDATION_PARAMS } from '../../lib/i18n';
import { usePageTitle } from '../../lib/use-page-title';
import { AuthCard } from './AuthCard';
import { useMe, useRegisterMutation } from './hooks';

type RegisterValues = z.input<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation();
  usePageTitle(t('meta.registerTitle'));
  const locale = useLocale();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { data: user } = useMe();
  const register = useRegisterMutation();
  const next = safeNextPath(params.get('next'));
  const form = useForm<RegisterValues, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', passwordConfirm: '', preferredLocale: locale },
  });
  const { errors } = form.formState;

  if (user) return <Navigate to={next} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      toast.success(t('register.welcome'));
      navigate(next, { replace: true });
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['fullName', 'email', 'password', 'passwordConfirm', 'preferredLocale']);
    }
  });

  return (
    <AuthCard
      title={t('register.title')}
      intro={t('register.intro')}
      footer={
        <>
          {t('register.haveAccount')}{' '}
          <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
            {t('register.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {register.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(register.error)}</FormAlert> : null}
        <Field label={t('fields.fullName')} error={errors.fullName?.message} required>
          {(p) => <Input {...p} autoComplete="name" {...form.register('fullName')} />}
        </Field>
        <Field label={t('fields.email')} error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...form.register('email')} />}
        </Field>
        <Field label={t('fields.password')} hint={t('fields.passwordHint', VALIDATION_PARAMS)} error={errors.password?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Field label={t('fields.passwordConfirm')} error={errors.passwordConfirm?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('passwordConfirm')} />}
        </Field>
        <Field label={t('fields.preferredLocale')} error={errors.preferredLocale?.message}>
          {(p) => (
            <Select {...p} {...form.register('preferredLocale')}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {tc(`language.${l}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('register.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}

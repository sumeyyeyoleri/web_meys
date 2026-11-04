import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPasswordSchema } from '@painter/shared';
import type { z } from 'zod';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useErrorMessage } from '../../components/ui/States';
import { isApiError } from '../../lib/api';
import { applyApiFieldErrors } from '../../lib/form-errors';
import { useValidationMessage, VALIDATION_PARAMS } from '../../lib/i18n';
import { usePageTitle } from '../../lib/use-page-title';
import { AdminAuthCard } from './AdminAuthCard';
import { useResetPasswordMutation } from './hooks';

type ResetValues = z.input<typeof resetPasswordSchema>;

/** `/admin/reset-password?token=…` — the link from the reset email. */
export function AdminResetPasswordPage() {
  const { t } = useTranslation('account');
  usePageTitle(t('meta.resetTitle'));
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPasswordMutation();
  const errorMessage = useErrorMessage();
  const translate = useValidationMessage();
  const form = useForm<ResetValues, unknown, z.output<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', passwordConfirm: '' },
  });
  const { errors } = form.formState;

  if (!token) {
    return (
      <AdminAuthCard heading={t('reset.title')}>
        <div className="flex flex-col gap-5">
          <FormAlert>{t('reset.missingToken')}</FormAlert>
          <ButtonLink to="/admin/forgot-password" variant="secondary">
            {t('reset.requestNew')}
          </ButtonLink>
        </div>
      </AdminAuthCard>
    );
  }

  if (reset.isSuccess) {
    return (
      <AdminAuthCard heading={t('reset.title')}>
        <div className="flex flex-col gap-5">
          <FormAlert tone="success">{t('reset.success')}</FormAlert>
          <ButtonLink to="/admin/login">{t('reset.goLogin')}</ButtonLink>
        </div>
      </AdminAuthCard>
    );
  }

  const tokenRejected = isApiError(reset.error, 'RESET_TOKEN_INVALID');
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await reset.mutateAsync(values);
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['password', 'passwordConfirm']);
    }
  });

  return (
    <AdminAuthCard heading={t('reset.title')} intro={t('reset.intro')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {tokenRejected ? (
          <FormAlert>
            {translate('validation.resetTokenInvalid')}{' '}
            <Link to="/admin/forgot-password" className="font-semibold underline underline-offset-4">
              {t('reset.requestNew')}
            </Link>
          </FormAlert>
        ) : reset.isError && !Object.keys(errors).length ? (
          <FormAlert>{errorMessage(reset.error)}</FormAlert>
        ) : null}
        <Field label={t('fields.newPassword')} hint={t('fields.passwordHint', VALIDATION_PARAMS)} error={errors.password?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Field label={t('fields.passwordConfirm')} error={errors.passwordConfirm?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('passwordConfirm')} />}
        </Field>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('reset.submit')}
        </Button>
      </form>
    </AdminAuthCard>
  );
}

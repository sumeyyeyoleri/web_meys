import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { changePasswordSchema } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useErrorMessage } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { applyApiFieldErrors } from '../../lib/form-errors';
import { VALIDATION_PARAMS } from '../../lib/i18n';
import { AdminPageHeader } from './AdminPageHeader';
import { useChangePassword } from './hooks';

type Values = z.input<typeof changePasswordSchema>;

/** Changes the artist's password; every other session is signed out. */
export function ChangePasswordPage() {
  const { t } = useTranslation('admin');
  const { t: ta } = useTranslation('account');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const change = useChangePassword();
  const form = useForm<Values, unknown, z.output<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      form.reset();
      toast.success(t('password.saved'));
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['currentPassword', 'newPassword', 'newPasswordConfirm']);
    }
  });

  return (
    <>
      <AdminPageHeader title={t('password.title')} intro={t('password.intro')} />
      <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-5">
        {change.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(change.error)}</FormAlert> : null}
        <Field label={t('password.current')} error={errors.currentPassword?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="current-password" {...form.register('currentPassword')} />}
        </Field>
        <Field label={ta('fields.newPassword')} hint={ta('fields.passwordHint', VALIDATION_PARAMS)} error={errors.newPassword?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('newPassword')} />}
        </Field>
        <Field label={ta('fields.passwordConfirm')} error={errors.newPasswordConfirm?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...form.register('newPasswordConfirm')} />}
        </Field>
        <Button type="submit" loading={change.isPending} className="self-start">
          {t('password.submit')}
        </Button>
      </form>
    </>
  );
}

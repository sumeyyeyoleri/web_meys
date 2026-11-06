import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminProfileSchema, changeEmailSchema, changePasswordSchema, type UserDto } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Inputs';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useErrorMessage } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { applyApiFieldErrors } from '../../lib/form-errors';
import { VALIDATION_PARAMS } from '../../lib/i18n';
import { useMe } from '../auth/hooks';
import { AdminPageHeader } from './AdminPageHeader';
import { Section } from './content/Section';
import { useChangeEmail, useChangePassword, useUpdateProfile } from './hooks';

/** "My account": the artist's display name, sign-in email and password (PROMPT.md §10). */
export function AccountPage() {
  const { t } = useTranslation('admin');
  const me = useMe();
  const { hash } = useLocation();
  const loaded = !!me.data;
  // `/admin/account#password` (the former "Change password" page) opens at that section.
  useEffect(() => {
    if (loaded && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loaded, hash]);
  return (
    <>
      <AdminPageHeader title={t('account.title')} intro={t('account.intro')} />
      {me.data ? (
        <div className="flex max-w-xl flex-col gap-6">
          <NameForm user={me.data} />
          <EmailForm user={me.data} />
          <PasswordForm />
        </div>
      ) : (
        <LoadingBlock />
      )}
    </>
  );
}

function NameForm({ user }: { user: UserDto }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const update = useUpdateProfile();
  const form = useForm<z.input<typeof adminProfileSchema>, unknown, z.output<typeof adminProfileSchema>>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: { name: user.name ?? '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset({ name: saved.name ?? '' });
      toast.success(t('account.nameSaved'));
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['name']);
    }
  });

  return (
    <Section id="name" title={t('account.nameTitle')} intro={t('account.nameIntro')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {update.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(update.error)}</FormAlert> : null}
        <Field label={t('account.name')} optional error={errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" maxLength={80} {...form.register('name')} />}
        </Field>
        <Button type="submit" variant="secondary" loading={update.isPending} className="self-start">
          {t('account.nameSubmit')}
        </Button>
      </form>
    </Section>
  );
}

function EmailForm({ user }: { user: UserDto }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const change = useChangeEmail();
  const form = useForm<z.input<typeof changeEmailSchema>, unknown, z.output<typeof changeEmailSchema>>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await change.mutateAsync(values);
      form.reset();
      toast.success(t('account.emailSaved', { email: saved.email }));
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['newEmail', 'currentPassword']);
    }
  });

  return (
    <Section id="email" title={t('account.emailTitle')} intro={t('account.emailIntro')}>
      <p className="text-[15px]">
        {t('account.currentEmail')} <strong className="break-all">{user.email}</strong>
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {change.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(change.error)}</FormAlert> : null}
        <Field label={t('account.newEmail')} error={errors.newEmail?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" {...form.register('newEmail')} />}
        </Field>
        <Field label={t('password.current')} error={errors.currentPassword?.message} required>
          {(p) => <PasswordInput {...p} autoComplete="current-password" {...form.register('currentPassword')} />}
        </Field>
        <Button type="submit" variant="secondary" loading={change.isPending} className="self-start">
          {t('account.emailSubmit')}
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const { t } = useTranslation('admin');
  const { t: ta } = useTranslation('account');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const change = useChangePassword();
  const form = useForm<z.input<typeof changePasswordSchema>, unknown, z.output<typeof changePasswordSchema>>({
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
    <Section id="password" title={t('password.title')} intro={t('password.intro')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
        <Button type="submit" variant="secondary" loading={change.isPending} className="self-start">
          {t('password.submit')}
        </Button>
      </form>
    </Section>
  );
}

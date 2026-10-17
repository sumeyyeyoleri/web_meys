import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema, type UserDto } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Inputs';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useErrorMessage } from '../../components/ui/States';
import { applyApiFieldErrors } from '../../lib/form-errors';
import { useLoginMutation } from './hooks';

type LoginValues = z.input<typeof loginSchema>;

/** Login form; also used inside the order wizard so the wizard keeps its state. */
export function LoginForm({ defaultEmail, onSuccess }: { defaultEmail?: string; onSuccess: (user: UserDto) => void }) {
  const { t } = useTranslation('account');
  const errorMessage = useErrorMessage();
  const login = useLoginMutation();
  const form = useForm<LoginValues, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail ?? '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      onSuccess(await login.mutateAsync(values));
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['email', 'password']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {login.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(login.error)}</FormAlert> : null}
      <Field label={t('fields.email')} error={errors.email?.message} required>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...form.register('email')} />}
      </Field>
      <Field label={t('fields.password')} error={errors.password?.message} required>
        {(p) => <PasswordInput {...p} autoComplete="current-password" {...form.register('password')} />}
      </Field>
      <Link to="/forgot-password" className="-mt-2 inline-flex min-h-11 items-center self-start text-sm text-text-muted underline-offset-4 hover:text-text hover:underline">
        {t('login.forgot')}
      </Link>
      <Button type="submit" loading={form.formState.isSubmitting}>
        {t('login.submit')}
      </Button>
    </form>
  );
}

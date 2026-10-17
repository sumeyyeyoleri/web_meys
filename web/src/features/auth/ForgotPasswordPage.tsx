import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema } from '@painter/shared';
import type { z } from 'zod';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Inputs';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useErrorMessage } from '../../components/ui/States';
import { usePageTitle } from '../../lib/use-page-title';
import { useSite } from '../public/hooks';
import { AuthCard } from './AuthCard';
import { useForgotPasswordMutation } from './hooks';

type ForgotValues = z.input<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation('account');
  usePageTitle(t('meta.forgotTitle'));
  const { data: site, isPending } = useSite();
  const forgot = useForgotPasswordMutation();
  const errorMessage = useErrorMessage();
  const form = useForm<ForgotValues, unknown, z.output<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const back = (
    <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
      {t('forgot.back')}
    </Link>
  );

  let body;
  if (isPending) {
    body = <LoadingBlock />;
  } else if (!site?.settings.emailAvailable) {
    // Never pretend an email will be sent when the site cannot send emails.
    body = (
      <div className="flex flex-col gap-5">
        <FormAlert tone="info">{t('forgot.unavailable')}</FormAlert>
        <ButtonLink to="/contact" variant="secondary">
          {t('forgot.contact')}
        </ButtonLink>
      </div>
    );
  } else if (forgot.isSuccess) {
    body = (
      <FormAlert tone="success">
        <p className="font-semibold">{t('forgot.sentTitle')}</p>
        <p className="mt-1 text-text-muted">{t('forgot.sent', { email: forgot.variables.email })}</p>
      </FormAlert>
    );
  } else {
    body = (
      <form
        onSubmit={form.handleSubmit((values) => forgot.mutate(values))}
        noValidate
        className="flex flex-col gap-5"
      >
        {forgot.isError ? <FormAlert>{errorMessage(forgot.error)}</FormAlert> : null}
        <Field label={t('fields.email')} error={form.formState.errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...form.register('email')} />}
        </Field>
        <Button type="submit" loading={forgot.isPending}>
          {t('forgot.submit')}
        </Button>
      </form>
    );
  }

  return (
    <AuthCard title={t('forgot.title')} intro={t('forgot.intro')} footer={back}>
      {body}
    </AuthCard>
  );
}

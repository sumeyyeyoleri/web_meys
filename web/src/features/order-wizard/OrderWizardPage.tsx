import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ContactStepInput } from '@painter/shared';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { FormAlert } from '../../components/ui/FormAlert';
import { useErrorMessage } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { isApiError } from '../../lib/api';
import { usePageTitle } from '../../lib/use-page-title';
import { useMe } from '../auth/hooks';
import { LoginForm } from '../auth/LoginForm';
import { useServices, useSite } from '../public/hooks';
import { SummaryPanel } from './SummaryPanel';
import { useLeaveGuard } from './useLeaveGuard';
import { useSubmitOrder } from './useSubmitOrder';
import { useWizard } from './useWizard';
import { WizardHeader } from './WizardHeader';
import { WizardSteps } from './WizardSteps';

export function OrderWizardPage() {
  const { t } = useTranslation('order');
  usePageTitle(t('meta.title'));
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { data: site } = useSite();
  const { data: user, isPending: userPending } = useMe();
  const services = useServices();
  const wizard = useWizard({ user, services: services.data, servicesSettled: !services.isPending });
  const submit = useSubmitOrder();
  const guard = useLeaveGuard(wizard.dirty && !submit.isSuccess);
  const [loginFor, setLoginFor] = useState<ContactStepInput | null>(null);
  const budgetRequired = site?.settings.budgetRequired ?? false;
  const deadlineRequired = site?.settings.deadlineRequired ?? false;
  const isAdmin = user?.role === 'ADMIN';

  const stepTitle = (key: string) => t(`steps.${key}`);

  function send() {
    const parsed = wizard.buildPayload(budgetRequired, deadlineRequired);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
      const step = wizard.showErrors(fields);
      if (step) toast.error(t('errors.fixStep', { step: stepTitle(step) }));
      return;
    }
    const wasGuest = !user;
    submit.mutate(
      { data: parsed.data, files: wizard.files },
      {
        onSuccess: (result) => {
          guard.allow();
          navigate(`/order/confirmation/${result.order.id}`, {
            state: { accountCreated: wasGuest && result.created, email: result.user.email },
          });
        },
        onError: (error) => {
          if (isApiError(error, 'ACCOUNT_EXISTS_LOGIN_REQUIRED')) {
            wizard.markAccountExists();
            return;
          }
          if (isApiError(error) && Object.keys(error.fields).length) {
            const step = wizard.showErrors(error.fields);
            toast.error(step === 'references' ? t('errors.filesInvalid') : t('errors.fixStep', { step: stepTitle(step ?? 'review') }));
            return;
          }
          toast.error(errorMessage(error));
        },
      },
    );
  }

  return (
    <div className="container-content pt-32 pb-40 sm:pt-40 lg:pb-24">
      <WizardHeader businessName={site?.settings.businessName ?? ''} current={wizard.step} reached={wizard.reached} onJump={wizard.jumpTo} />
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          {wizard.inspirationUnavailable && wizard.step === 0 ? <FormAlert tone="info">{t('inspiration.unavailable')}</FormAlert> : null}
          <WizardSteps
            wizard={wizard}
            user={user ?? null}
            userPending={userPending}
            services={services.data}
            servicesError={services.isError}
            budgetRequired={budgetRequired}
            deadlineRequired={deadlineRequired}
            submitting={submit.isPending}
            isAdmin={isAdmin}
            onLoginRequest={(typed) => {
              wizard.keepContact(typed);
              setLoginFor(typed);
            }}
            onSubmit={send}
          />
        </div>
        <SummaryPanel values={wizard.values} files={wizard.files} services={services.data} inspiration={wizard.inspiration} />
      </div>

      <Dialog
        open={loginFor !== null}
        onClose={() => setLoginFor(null)}
        title={t('contact.loginDialogTitle')}
        description={t('contact.loginDialogIntro')}
      >
        <LoginForm
          defaultEmail={loginFor?.email}
          onSuccess={(signedIn) => {
            if (loginFor) wizard.afterInlineLogin(loginFor, signedIn);
            setLoginFor(null);
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={guard.blocked}
        onClose={guard.stay}
        onConfirm={guard.leave}
        title={t('leave.title')}
        description={t('leave.body')}
        confirmLabel={t('leave.leave')}
        destructive
      />
    </div>
  );
}

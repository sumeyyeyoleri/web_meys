import type { ContactStepInput, ServiceDto, UserDto } from '@painter/shared';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ContactStep } from './steps/ContactStep';
import { DetailsStep } from './steps/DetailsStep';
import { DimensionsStep } from './steps/DimensionsStep';
import { ReferencesStep } from './steps/ReferencesStep';
import { ReviewStep } from './steps/ReviewStep';
import { ServiceStep } from './steps/ServiceStep';
import type { Wizard } from './useWizard';

interface WizardStepsProps {
  wizard: Wizard;
  user: UserDto | null;
  userPending: boolean;
  services: ServiceDto[] | undefined;
  servicesError: boolean;
  budgetRequired: boolean;
  deadlineRequired: boolean;
  submitting: boolean;
  isAdmin: boolean;
  onLoginRequest: (typed: ContactStepInput) => void;
  onSubmit: () => void;
}

/** Renders the current step with the wizard's stored values. */
export function WizardSteps({
  wizard,
  user,
  userPending,
  services,
  servicesError,
  budgetRequired,
  deadlineRequired,
  submitting,
  isAdmin,
  onLoginRequest,
  onSubmit,
}: WizardStepsProps) {
  const errors = wizard.stepErrors;
  let content = null;
  if (!wizard.ready || userPending) {
    content = <LoadingBlock className="min-h-[40vh]" />;
  } else {
    switch (wizard.stepKey) {
      case 'service':
        content = (
          <ServiceStep
            values={wizard.values.service}
            onNext={(v) => wizard.save('service', v, 1)}
            serverErrors={errors.service}
            services={services}
            servicesError={servicesError}
            inspiration={wizard.inspiration}
            inspirationServiceMatched={wizard.serviceMatched}
            onRemoveInspiration={wizard.removeInspiration}
          />
        );
        break;
      case 'dimensions':
        content = (
          <DimensionsStep
            values={wizard.values.dimensions}
            onNext={(v) => wizard.save('dimensions', v, 1)}
            onBack={(v) => wizard.save('dimensions', v, -1)}
            serverErrors={errors.dimensions}
            isWallService={wizard.isWallService}
          />
        );
        break;
      case 'references':
        content = (
          <ReferencesStep
            files={wizard.files}
            onAdd={wizard.addFiles}
            onReplace={wizard.replaceFile}
            onRemove={wizard.removeFile}
            inspiration={wizard.inspiration}
            onRemoveInspiration={wizard.removeInspiration}
            serverErrors={errors.references}
            onNext={() => wizard.goTo(wizard.step + 1)}
            onBack={() => wizard.goTo(wizard.step - 1)}
          />
        );
        break;
      case 'details':
        content = (
          <DetailsStep
            values={wizard.values.details}
            onNext={(v) => wizard.save('details', v, 1)}
            onBack={(v) => wizard.save('details', v, -1)}
            serverErrors={errors.details}
            budgetRequired={budgetRequired}
            deadlineRequired={deadlineRequired}
          />
        );
        break;
      case 'contact':
        content = (
          <ContactStep
            key={user?.id ?? 'guest'}
            values={wizard.values.contact}
            onNext={(v) => wizard.save('contact', v, 1)}
            onBack={(v) => wizard.save('contact', v, -1)}
            serverErrors={errors.contact}
            user={user}
            accountExists={wizard.accountExists}
            onLoginRequest={onLoginRequest}
          />
        );
        break;
      case 'review':
        content = (
          <ReviewStep
            values={wizard.values}
            files={wizard.files}
            services={services}
            inspiration={wizard.inspiration}
            serverErrors={errors.review}
            submitting={submitting}
            submitDisabled={isAdmin}
            onEdit={wizard.jumpTo}
            onBack={() => wizard.goTo(wizard.step - 1)}
            onSubmit={onSubmit}
          />
        );
        break;
    }
  }

  return content;
}

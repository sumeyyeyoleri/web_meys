import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildCreateOrderSchema, type ContactStepInput, type ServiceDto, type UserDto } from '@painter/shared';
import { useLocale } from '../../lib/i18n';
import { usePortfolioItem } from '../public/hooks';
import { matchServiceForCategory } from './service-match';
import { errorsByStep, initialValues, newIdempotencyKey, STEPS, type StepKey, type WizardFile, type WizardValues } from './wizard-model';

type StepErrors = Partial<Record<StepKey, Record<string, string>>>;

/** Fills empty contact fields from the signed-in user's profile (typed values win). */
function prefillContact(contact: ContactStepInput, user: UserDto): ContactStepInput {
  const p = user.profile;
  const pick = (current: string | undefined, fallback: string | null | undefined) => (current?.trim() ? current : (fallback ?? ''));
  return {
    ...contact,
    fullName: pick(contact.fullName, p?.fullName),
    email: pick(contact.email, user.email),
    phone: pick(contact.phone, p?.phone),
    country: pick(contact.country, p?.country),
    city: pick(contact.city, p?.city),
    postalCode: pick(contact.postalCode, p?.postalCode),
    street: pick(contact.street, p?.street),
    houseNumber: pick(contact.houseNumber, p?.houseNumber),
    addressExtra: pick(typeof contact.addressExtra === 'string' ? contact.addressExtra : '', p?.addressExtra),
    password: '',
    passwordConfirm: '',
  };
}

interface UseWizardOptions {
  user: UserDto | null | undefined;
  services: ServiceDto[] | undefined;
  /** True once the services request finished (successfully or not). */
  servicesSettled: boolean;
}

export function useWizard({ user, services, servicesSettled }: UseWizardOptions) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [values, setValues] = useState<WizardValues>(() => initialValues(locale));
  const [files, setFiles] = useState<WizardFile[]>([]);
  const [inspirationId, setInspirationId] = useState<string | null>(fromId);
  const [serviceMatched, setServiceMatched] = useState(false);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});
  const [accountExists, setAccountExists] = useState(false);
  const [preselected, setPreselected] = useState(false);

  const inspirationQuery = usePortfolioItem(inspirationId);
  const inspiration = inspirationQuery.data?.allowSimilarRequest ? inspirationQuery.data : null;
  const inspirationUnavailable = !!fromId && (inspirationQuery.isError || inspirationQuery.data?.allowSimilarRequest === false);
  // Step 1 is shown once services and the catalog example (if any) are known, so preselection is applied.
  const dataReady = servicesSettled && (!inspirationId || !inspirationQuery.isPending);
  // The service step's form reads its defaults on mount, so wait until preselection is applied.
  const ready = dataReady && preselected;

  // Preselect a service once: ?service=<id>, else the one matching the catalog example.
  useEffect(() => {
    if (preselected || !dataReady) return;
    const requested = params.get('service');
    let serviceId = services?.find((s) => s.id === requested)?.id ?? '';
    if (!serviceId && inspiration && services) {
      serviceId = matchServiceForCategory(services, inspiration.category, t(`category.${inspiration.category}`))?.id ?? '';
      setServiceMatched(!!serviceId);
    }
    if (serviceId) setValues((v) => ({ ...v, service: { ...v.service, serviceId } }));
    setPreselected(true);
  }, [preselected, dataReady, services, inspiration, params, t]);

  // Object URLs are released when files are removed (below) and when the wizard closes.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), []);

  const goTo = (index: number) => {
    setStep(index);
    setReached((r) => Math.max(r, index));
  };

  const contactWithProfile = (contact: ContactStepInput, u: UserDto | null | undefined) => (u ? prefillContact(contact, u) : contact);

  return {
    step,
    stepKey: STEPS[step] as StepKey,
    reached,
    values,
    files,
    inspiration,
    inspirationUnavailable,
    serviceMatched: serviceMatched && !!inspiration,
    ready,
    stepErrors,
    accountExists,
    dirty: reached > 0 || files.length > 0,
    isWallService: !!services?.find((s) => s.id === values.service.serviceId)?.isWallService,

    goTo,
    jumpTo: (key: StepKey) => goTo(STEPS.indexOf(key)),
    /** Saves a step's values and moves on (or back). */
    save<K extends keyof WizardValues>(key: K, value: WizardValues[K], direction: 1 | -1) {
      setValues((v) => {
        const next = { ...v, [key]: value };
        // Entering the contact step: start from the profile of a signed-in customer.
        if (STEPS[step + direction] === 'contact') next.contact = contactWithProfile(next.contact, user);
        return next;
      });
      setStepErrors((e) => ({ ...e, [STEPS[step] as StepKey]: undefined }));
      goTo(step + direction);
    },
    removeInspiration() {
      setInspirationId(null);
      setServiceMatched(false);
      setValues((v) => ({ ...v, service: { ...v.service, additionalSpecs: '' } }));
    },
    addFiles(list: File[]) {
      setFiles((current) => [...current, ...list.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
      setStepErrors((e) => ({ ...e, references: undefined }));
    },
    replaceFile(id: string, file: File) {
      setFiles((current) =>
        current.map((f) => {
          if (f.id !== id) return f;
          URL.revokeObjectURL(f.previewUrl);
          return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
        }),
      );
      setStepErrors((e) => ({ ...e, references: undefined }));
    },
    removeFile(id: string) {
      setFiles((current) => {
        const found = current.find((f) => f.id === id);
        if (found) URL.revokeObjectURL(found.previewUrl);
        return current.filter((f) => f.id !== id);
      });
      setStepErrors((e) => ({ ...e, references: undefined }));
    },
    /** Keeps what was typed in the contact step, then fills the rest from the new user's profile. */
    afterInlineLogin(typed: ContactStepInput, signedIn: UserDto) {
      setAccountExists(false);
      setStepErrors((e) => ({ ...e, contact: undefined }));
      setValues((v) => ({ ...v, contact: prefillContact(typed, signedIn) }));
    },
    keepContact(typed: ContactStepInput) {
      setValues((v) => ({ ...v, contact: typed }));
    },
    /** Full client-side validation with the same schema the server uses. */
    buildPayload(budgetRequired: boolean, deadlineRequired: boolean) {
      return buildCreateOrderSchema({ isGuest: !user, budgetRequired, deadlineRequired }).safeParse({
        idempotencyKey,
        inspirationItemId: inspiration?.id ?? '',
        ...values.service,
        ...values.dimensions,
        ...values.details,
        ...values.contact,
        privacyAccepted: true,
      });
    },
    /** Shows field errors (server or client) on their steps and opens the first affected step. */
    showErrors(fields: Record<string, string>): StepKey | undefined {
      const grouped = errorsByStep(fields);
      setStepErrors(grouped);
      const first = STEPS.find((key) => grouped[key]);
      if (first) goTo(STEPS.indexOf(first));
      return first;
    },
    markAccountExists() {
      // One clear alert with a login button (rendered by the contact step), not a duplicate field error.
      setAccountExists(true);
      setStepErrors({});
      goTo(STEPS.indexOf('contact'));
    },
  };
}

export type Wizard = ReturnType<typeof useWizard>;

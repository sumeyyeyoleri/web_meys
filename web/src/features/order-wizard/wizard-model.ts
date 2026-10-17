import {
  accountStepShape,
  contactStepShape,
  detailsStepShape,
  dimensionsStepShape,
  serviceStepShape,
  type ContactStepInput,
  type DetailsStepInput,
  type DimensionsStepInput,
  type Locale,
} from '@painter/shared';

export const STEPS = ['service', 'dimensions', 'references', 'details', 'contact', 'review'] as const;
export type StepKey = (typeof STEPS)[number];

export interface ServiceValues {
  serviceId?: string;
  customRequest?: string;
  additionalSpecs?: string;
}

export interface WizardFile {
  id: string;
  file: File;
  /** Object URL for the thumbnail; revoked when the file is removed or the wizard closes. */
  previewUrl: string;
}

/** Raw (form) values per step, kept while moving back and forth between steps. */
export interface WizardValues {
  service: ServiceValues;
  dimensions: DimensionsStepInput;
  details: DetailsStepInput;
  contact: ContactStepInput;
  privacyAccepted: boolean;
}

export function initialValues(locale: Locale): WizardValues {
  return {
    service: { serviceId: '', customRequest: '', additionalSpecs: '' },
    dimensions: { width: '', height: '', unit: 'CM', wallWidth: '', wallHeight: '', surfaceDetails: '', extraSpecifications: '' },
    details: {
      title: '',
      description: '',
      stylePreferences: '',
      colorPreferences: '',
      themePreferences: '',
      budgetMin: '',
      budgetMax: '',
      deadline: '',
      extraInstructions: '',
    },
    contact: {
      fullName: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      postalCode: '',
      street: '',
      houseNumber: '',
      addressExtra: '',
      communicationLocale: locale,
      password: '',
      passwordConfirm: '',
    },
    privacyAccepted: false,
  };
}

/** Which step owns a (server or full-schema) validation error path. */
const FIELD_STEPS: Record<string, StepKey> = Object.fromEntries([
  ...Object.keys(serviceStepShape).map((k) => [k, 'service']),
  ...Object.keys(dimensionsStepShape).map((k) => [k, 'dimensions']),
  ...Object.keys(detailsStepShape).map((k) => [k, 'details']),
  ...Object.keys(contactStepShape).map((k) => [k, 'contact']),
  ...Object.keys(accountStepShape).map((k) => [k, 'contact']),
  ['files', 'references'],
  ['privacyAccepted', 'review'],
]);

export function stepForField(path: string): StepKey {
  return FIELD_STEPS[path.split('.')[0] ?? ''] ?? 'review';
}

/** Groups `{ "budgetMax": "validation.budgetRange", ... }` by step. */
export function errorsByStep(fields: Record<string, string>): Partial<Record<StepKey, Record<string, string>>> {
  const out: Partial<Record<StepKey, Record<string, string>>> = {};
  for (const [path, key] of Object.entries(fields)) {
    const step = stepForField(path);
    (out[step] ??= {})[path] = key;
  }
  return out;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

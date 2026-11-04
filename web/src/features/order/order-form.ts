import { ORDER_FORM_FIELDS, type OrderFormInput, type UserDto } from '@painter/shared';

/** Raw form values (strings from the inputs); parsed with the shared schema on submit. */
export type OrderFormValues = Omit<OrderFormInput, 'privacyAccepted'> & { privacyAccepted: boolean };

export interface OrderFile {
  id: string;
  file: File;
  /** Object URL for the thumbnail; revoked when the file is removed or the page closes. */
  previewUrl: string;
}

/** Empty form; the country defaults to Belgium (in the site language). */
export function initialValues(defaultCountry: string): OrderFormValues {
  return {
    serviceId: '',
    width: '',
    height: '',
    unit: 'CM',
    description: '',
    fullName: '',
    email: '',
    phone: '',
    country: defaultCountry,
    city: '',
    postalCode: '',
    street: '',
    houseNumber: '',
    addressExtra: '',
    privacyAccepted: false,
  };
}

type ContactField = 'fullName' | 'email' | 'phone' | 'country' | 'city' | 'postalCode' | 'street' | 'houseNumber' | 'addressExtra';

/** Values from a signed-in customer's profile, for the contact fields they fill. */
export function profileValues(user: UserDto): Partial<Record<ContactField, string>> {
  const p = user.profile;
  const values: Partial<Record<ContactField, string | null | undefined>> = {
    fullName: p?.fullName,
    email: user.email,
    phone: p?.phone,
    country: p?.country,
    city: p?.city,
    postalCode: p?.postalCode,
    street: p?.street,
    houseNumber: p?.houseNumber,
    addressExtra: p?.addressExtra,
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string' && v.trim())) as Partial<
    Record<ContactField, string>
  >;
}

/** Field errors in the order the fields appear (`files.N` errors belong to the photo picker). */
export function splitServerErrors(fields: Record<string, string>) {
  const formErrors: Array<[keyof OrderFormValues, string]> = [];
  const fileErrors: Record<string, string> = {};
  for (const name of ORDER_FORM_FIELDS) {
    if (fields[name]) formErrors.push([name, fields[name]]);
  }
  for (const [path, key] of Object.entries(fields)) {
    if (path === 'files' || path.startsWith('files.')) fileErrors[path] = key;
  }
  return { formErrors, fileErrors, inspirationInvalid: !!fields.inspirationItemId };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

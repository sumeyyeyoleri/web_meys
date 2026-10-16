import { z } from 'zod';
import { localeSchema, optionalPhoneSchema, optionalString, requiredString } from './common';

export const updateProfileSchema = z.object({
  fullName: requiredString(120),
  phone: optionalPhoneSchema,
  country: optionalString(100),
  city: optionalString(100),
  postalCode: optionalString(20),
  street: optionalString(150),
  houseNumber: optionalString(20),
  addressExtra: optionalString(150),
  preferredLocale: localeSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

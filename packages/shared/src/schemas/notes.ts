import { z } from 'zod';
import { localeSchema, requiredString } from './common';

export const internalNoteSchema = z.object({
  body: requiredString(5000),
});
export type InternalNoteInput = z.infer<typeof internalNoteSchema>;

/** The artist's dashboard preferences (`PATCH /api/admin/me`). */
export const adminPreferencesSchema = z.object({
  preferredLocale: localeSchema,
});
export type AdminPreferencesInput = z.infer<typeof adminPreferencesSchema>;

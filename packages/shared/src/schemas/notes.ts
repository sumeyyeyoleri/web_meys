import { z } from 'zod';
import { requiredString } from './common';

export const internalNoteSchema = z.object({
  body: requiredString(5000),
});
export type InternalNoteInput = z.infer<typeof internalNoteSchema>;

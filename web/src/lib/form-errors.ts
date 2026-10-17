import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from './api';

/**
 * Puts the API's field errors (i18n keys) onto the matching form fields.
 * Returns true when at least one field error was applied.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const [field, key] of Object.entries(error.fields)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message: key }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}

/** Only allow same-site relative redirects after login (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

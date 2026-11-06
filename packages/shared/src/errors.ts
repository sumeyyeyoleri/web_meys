/** Machine-readable error codes returned in `{ error: { code, message, fields? } }`. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CSRF_INVALID',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'RESET_TOKEN_INVALID',
  'ORDER_INVALID_TRANSITION',
  'ORDER_QUOTE_REQUIRED',
  'ORDER_NOT_ARCHIVABLE',
  'UPLOAD_TOO_MANY_FILES',
  'UPLOAD_FILE_TOO_LARGE',
  'UPLOAD_INVALID_TYPE',
  'UPLOAD_UNSAFE_SVG',
  'TRANSLATION_UNAVAILABLE',
  'TRANSLATION_FAILED',
  'TRANSLATION_LIMIT_REACHED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** `fields` maps a dotted field path to an i18n validation key, e.g. `{ "email": "validation.email" }`. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

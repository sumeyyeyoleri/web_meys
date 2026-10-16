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
  'EMAIL_IN_USE',
  'ACCOUNT_EXISTS_LOGIN_REQUIRED',
  'RESET_TOKEN_INVALID',
  'ORDER_INVALID_TRANSITION',
  'ORDER_QUOTE_REQUIRED',
  'ORDER_NOT_ARCHIVABLE',
  'SERVICE_IN_USE',
  'UPLOAD_TOO_MANY_FILES',
  'UPLOAD_FILE_TOO_LARGE',
  'UPLOAD_INVALID_TYPE',
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

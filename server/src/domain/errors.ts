import type { ErrorCode } from '@painter/shared';

/** Error that maps directly onto the API error envelope. Thrown by services and domain code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
export const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);
export const unauthenticated = (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message);
export const validationError = (fields: Record<string, string>, message = 'Validation failed') =>
  new AppError(400, 'VALIDATION_ERROR', message, fields);

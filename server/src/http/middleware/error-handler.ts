import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@painter/shared';
import { AppError } from '../../domain/errors';
import { describeError, logger } from '../../infrastructure/logger';

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
  const body: ApiErrorBody = { error: { code, message, ...(fields && Object.keys(fields).length ? { fields } : {}) } };
  res.status(status).json(body);
}

/** Field path → i18n key (first issue per field). Non-key messages become `validation.invalid`. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_';
    fields[path] ??= issue.message.startsWith('validation.') ? issue.message : 'validation.invalid';
  }
  return fields;
}

function multerToError(error: MulterError): [number, ErrorCode, string, Record<string, string>] {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return [400, 'UPLOAD_FILE_TOO_LARGE', 'File is too large', { [error.field ?? 'files']: 'validation.fileTooLarge' }];
    case 'LIMIT_FILE_COUNT':
      return [400, 'UPLOAD_TOO_MANY_FILES', 'Too many files', { files: 'validation.tooManyFiles' }];
    case 'LIMIT_UNEXPECTED_FILE':
      return error.field === 'files' || error.field === 'file'
        ? [400, 'UPLOAD_TOO_MANY_FILES', 'Too many files', { [error.field]: 'validation.tooManyFiles' }]
        : [400, 'VALIDATION_ERROR', 'Unexpected file field', { [error.field ?? 'files']: 'validation.invalid' }];
    default:
      return [400, 'VALIDATION_ERROR', 'Invalid upload', { files: 'validation.invalid' }];
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    send(res, error.status, error.code, error.message, error.fields);
    return;
  }
  if (error instanceof ZodError) {
    send(res, 400, 'VALIDATION_ERROR', 'Validation failed', zodFieldErrors(error));
    return;
  }
  if (error instanceof MulterError) {
    send(res, ...multerToError(error));
    return;
  }
  const bodyError = error as { type?: unknown };
  if (bodyError.type === 'entity.too.large') {
    send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return;
  }
  if (bodyError.type === 'entity.parse.failed') {
    send(res, 400, 'VALIDATION_ERROR', 'Malformed JSON body');
    return;
  }
  logger.error('Unhandled error', { method: req.method, path: req.path, ...describeError(error) });
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};

export const apiNotFound: RequestHandler = (_req, res) => {
  send(res, 404, 'NOT_FOUND', 'Endpoint not found');
};

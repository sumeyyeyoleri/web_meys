import type { Request } from 'express';
import type { z } from 'zod';
import { idParamSchema } from '@painter/shared';
import { notFound } from '../../domain/errors';

/** Validation helpers used by controllers. A ZodError becomes a 400 in the error handler. */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.body ?? {});
}

export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.query);
}

/** A malformed id can never match a resource, so it is reported as 404. */
export function parseIdParam(req: Request, name = 'id'): string {
  const result = idParamSchema.safeParse({ id: req.params[name] });
  if (!result.success) throw notFound();
  return result.data.id;
}

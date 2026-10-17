import type { RequestHandler } from 'express';
import { logger } from '../../infrastructure/logger';

/** Logs method, path (no query string), status, duration and user id only. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - start) / 1_000_000n),
      userId: req.auth?.user.id,
    });
  });
  next();
};

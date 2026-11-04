import type { Request, RequestHandler } from 'express';
import { ORDER_TOKEN_HEADER } from '@painter/shared';
import { notFound } from '../../domain/errors';
import type { TrackingService } from '../../services/tracking.service';

/**
 * Resolves the `X-Order-Token` header into `req.trackedOrderId`. Missing, malformed, unknown,
 * expired and revoked tokens all get the same 404, so the response reveals nothing.
 */
export function requireTrackingToken(tracking: TrackingService): RequestHandler {
  return async (req, _res, next) => {
    const orderId = await tracking.resolve(req.get(ORDER_TOKEN_HEADER));
    if (!orderId) throw notFound('Order not found');
    req.trackedOrderId = orderId;
    next();
  };
}

/** For handlers behind `requireTrackingToken`. */
export function getTrackedOrderId(req: Request): string {
  if (!req.trackedOrderId) throw notFound('Order not found');
  return req.trackedOrderId;
}

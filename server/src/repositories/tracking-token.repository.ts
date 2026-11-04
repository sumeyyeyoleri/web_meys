import type { Db } from './db';

export function createTrackingTokenRepository(db: Db) {
  return {
    create(data: { orderId: string; tokenHash: string; expiresAt: Date }) {
      return db.orderTrackingToken.create({ data });
    },

    /** The token only if it is neither expired nor revoked. */
    findActive(tokenHash: string, now: Date) {
      return db.orderTrackingToken.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: now } } });
    },

    revokeAllForOrder(orderId: string, now: Date) {
      return db.orderTrackingToken.updateMany({ where: { orderId, revokedAt: null }, data: { revokedAt: now } });
    },
  };
}

export type TrackingTokenRepository = ReturnType<typeof createTrackingTokenRepository>;

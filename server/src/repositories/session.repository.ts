import type { Db } from './db';

export function createSessionRepository(db: Db) {
  return {
    create(data: { tokenHash: string; userId: string; expiresAt: Date }) {
      return db.session.create({ data });
    },

    findByTokenHash(tokenHash: string) {
      return db.session.findUnique({ where: { tokenHash }, include: { user: { include: { profile: true } } } });
    },

    extend(id: string, expiresAt: Date, lastUsedAt: Date) {
      return db.session.update({ where: { id }, data: { expiresAt, lastUsedAt } });
    },

    deleteByTokenHash(tokenHash: string) {
      return db.session.deleteMany({ where: { tokenHash } });
    },

    deleteAllForUser(userId: string) {
      return db.session.deleteMany({ where: { userId } });
    },

    deleteExpired(now: Date) {
      return db.session.deleteMany({ where: { expiresAt: { lt: now } } });
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;

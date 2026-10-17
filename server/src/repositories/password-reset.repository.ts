import type { Db } from './db';

export function createPasswordResetRepository(db: Db) {
  return {
    create(data: { tokenHash: string; userId: string; expiresAt: Date }) {
      return db.passwordResetToken.create({ data });
    },

    findByTokenHash(tokenHash: string) {
      return db.passwordResetToken.findUnique({ where: { tokenHash } });
    },

    /** Marks the token used; returns false if it was already used (single-use guard). */
    async consume(id: string, now: Date): Promise<boolean> {
      const result = await db.passwordResetToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } });
      return result.count === 1;
    },

    deleteUnusedForUser(userId: string) {
      return db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
    },
  };
}

export type PasswordResetRepository = ReturnType<typeof createPasswordResetRepository>;

import type { Locale } from '@prisma/client';
import type { Db } from './db';

/** Accounts are the artist's only (customers order without one). */
export function createUserRepository(db: Db) {
  return {
    findById(id: string) {
      return db.user.findUnique({ where: { id } });
    },

    findByEmail(email: string) {
      return db.user.findUnique({ where: { email: email.toLowerCase() } });
    },

    updatePassword(id: string, passwordHash: string) {
      return db.user.update({ where: { id }, data: { passwordHash } });
    },

    updatePreferredLocale(id: string, preferredLocale: Locale) {
      return db.user.update({ where: { id }, data: { preferredLocale } });
    },

    async findAdmins() {
      return db.user.findMany({ select: { id: true, email: true, preferredLocale: true } });
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
export type AdminUser = NonNullable<Awaited<ReturnType<UserRepository['findById']>>>;

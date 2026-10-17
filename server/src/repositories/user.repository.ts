import type { Locale, Role } from '@prisma/client';
import type { Db } from './db';

const withProfile = { profile: true } as const;

export interface ProfileFields {
  fullName: string;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  addressExtra?: string | null;
}

export function createUserRepository(db: Db) {
  return {
    findById(id: string) {
      return db.user.findUnique({ where: { id }, include: withProfile });
    },

    findByEmail(email: string) {
      return db.user.findUnique({ where: { email: email.toLowerCase() }, include: withProfile });
    },

    create(data: { email: string; passwordHash: string; role: Role; preferredLocale: Locale; profile: ProfileFields }) {
      return db.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          role: data.role,
          preferredLocale: data.preferredLocale,
          profile: { create: data.profile },
        },
        include: withProfile,
      });
    },

    updatePassword(id: string, passwordHash: string) {
      return db.user.update({ where: { id }, data: { passwordHash } });
    },

    updateProfile(id: string, preferredLocale: Locale, profile: ProfileFields) {
      return db.user.update({
        where: { id },
        data: {
          preferredLocale,
          profile: { upsert: { create: profile, update: profile } },
        },
        include: withProfile,
      });
    },

    async findAdmins() {
      return db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, preferredLocale: true },
      });
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
export type UserWithProfile = NonNullable<Awaited<ReturnType<UserRepository['findById']>>>;

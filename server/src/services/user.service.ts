import { localeToDb, type UpdateProfileInput } from '@painter/shared';
import type { Repositories } from '../repositories';

export function createUserService({ repos }: { repos: Repositories }) {
  return {
    updateProfile(userId: string, input: UpdateProfileInput) {
      const { preferredLocale, ...profile } = input;
      return repos.users.updateProfile(userId, localeToDb(preferredLocale), {
        fullName: profile.fullName,
        phone: profile.phone ?? null,
        country: profile.country ?? null,
        city: profile.city ?? null,
        postalCode: profile.postalCode ?? null,
        street: profile.street ?? null,
        houseNumber: profile.houseNumber ?? null,
        addressExtra: profile.addressExtra ?? null,
      });
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;

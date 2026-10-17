import { localeFromDb, type UserDto } from '@painter/shared';
import type { UserWithProfile } from '../../repositories/user.repository';
import { toIso } from './common';

export function toUserDto(user: UserWithProfile): UserDto {
  const p = user.profile;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    preferredLocale: localeFromDb(user.preferredLocale),
    profile: p
      ? {
          fullName: p.fullName,
          phone: p.phone,
          country: p.country,
          city: p.city,
          postalCode: p.postalCode,
          street: p.street,
          houseNumber: p.houseNumber,
          addressExtra: p.addressExtra,
        }
      : null,
    createdAt: toIso(user.createdAt),
  };
}

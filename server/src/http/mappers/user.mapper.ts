import { localeFromDb, type UserDto } from '@painter/shared';
import type { AdminUser } from '../../repositories/user.repository';
import { toIso } from './common';

export function toUserDto(user: AdminUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    preferredLocale: localeFromDb(user.preferredLocale),
    createdAt: toIso(user.createdAt),
  };
}

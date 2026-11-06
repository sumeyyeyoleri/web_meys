import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/password-hasher';

/**
 * Emergency reset (`npm run admin:reset-password`): makes `password` the artist's password and
 * signs out every session. The account is the one with `email` (ADMIN_EMAIL), or else the only
 * account — the artist may have changed the sign-in email in "My account".
 * Returns the account's current sign-in email, or null when there is no account yet.
 */
export async function resetAdminPassword(prisma: PrismaClient, { email, password }: { email: string; password: string }) {
  const user =
    (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!user) return null;
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
  ]);
  return user.email;
}

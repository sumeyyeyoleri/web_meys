/**
 * `npm run admin:reset-password` — only when run by hand. Sets the artist's password to
 * ADMIN_PASSWORD from `.env` and signs out every session (e.g. when the password is forgotten
 * and SMTP for "Forgot password" is not configured). The password itself is never printed.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PASSWORD_MIN_LENGTH } from '@painter/shared';
import { z } from 'zod';
import { resetAdminPassword } from './admin-recovery';

const env = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(PASSWORD_MIN_LENGTH, `ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`),
  })
  .parse(process.env);

const prisma = new PrismaClient();
try {
  const email = await resetAdminPassword(prisma, { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  if (email) {
    console.log(`The password of ${email} is now ADMIN_PASSWORD from .env. Every session was signed out.`);
  } else {
    console.error('No artist account exists yet. Run the seed first (npm run db:seed).');
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}

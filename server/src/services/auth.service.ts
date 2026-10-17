import {
  localeFromDb,
  localeToDb,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@painter/shared';
import { AppError } from '../domain/errors';
import { generateToken, sha256 } from '../infrastructure/crypto';
import { describeError, logger } from '../infrastructure/logger';
import { hashPassword, verifyPassword } from '../infrastructure/password-hasher';
import type { Repositories } from '../repositories';
import { isUniqueViolation } from '../repositories';
import type { UserWithProfile } from '../repositories/user.repository';
import type { EmailService } from './email.service';
import type { SessionService } from './session.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

interface Deps {
  repos: Repositories;
  sessions: SessionService;
  email: EmailService;
}

export function createAuthService({ repos, sessions, email }: Deps) {
  // Used to spend the same time on unknown emails as on wrong passwords.
  let dummyHash: Promise<string> | null = null;
  const getDummyHash = () => (dummyHash ??= hashPassword('timing-equaliser-not-a-real-password'));

  return {
    async register(input: RegisterInput): Promise<UserWithProfile> {
      if (await repos.users.findByEmail(input.email)) {
        throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists', {
          email: 'validation.emailInUse',
        });
      }
      try {
        return await repos.users.create({
          email: input.email,
          passwordHash: await hashPassword(input.password),
          role: 'CUSTOMER',
          preferredLocale: localeToDb(input.preferredLocale),
          profile: { fullName: input.fullName },
        });
      } catch (error) {
        if (isUniqueViolation(error, 'email')) {
          throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists', {
            email: 'validation.emailInUse',
          });
        }
        throw error;
      }
    },

    /** Never reveals whether the email exists. */
    async login(input: LoginInput): Promise<UserWithProfile> {
      const user = await repos.users.findByEmail(input.email);
      if (!user) {
        await verifyPassword(await getDummyHash(), input.password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();
      return user;
    },

    /**
     * Responds identically whether or not the account exists: the lookup and email run in the
     * background so the response time does not reveal registered addresses either.
     */
    forgotPassword(emailAddress: string): void {
      void (async () => {
        const user = await repos.users.findByEmail(emailAddress);
        if (!user) return;
        await repos.passwordResets.deleteUnusedForUser(user.id);
        const token = generateToken(32);
        await repos.passwordResets.create({
          tokenHash: sha256(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        });
        await email.sendPasswordReset({ email: user.email, locale: localeFromDb(user.preferredLocale) }, token);
      })().catch((error: unknown) => logger.error('Password reset request failed', describeError(error)));
    },

    /** Sets a new password and signs the user out everywhere. */
    async resetPassword(input: ResetPasswordInput): Promise<void> {
      const invalid = () =>
        new AppError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired', {
          token: 'validation.resetTokenInvalid',
        });
      const record = await repos.passwordResets.findByTokenHash(sha256(input.token));
      const now = new Date();
      if (!record || record.usedAt || record.expiresAt <= now) throw invalid();
      if (!(await repos.passwordResets.consume(record.id, now))) throw invalid();
      await repos.users.updatePassword(record.userId, await hashPassword(input.password));
      await sessions.destroyAllForUser(record.userId);
    },

    /** Changes the password, ends every session, and returns a fresh session for the current device. */
    async changePassword(userId: string, input: ChangePasswordInput) {
      const user = await repos.users.findById(userId);
      if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', {
          currentPassword: 'validation.currentPasswordWrong',
        });
      }
      await repos.users.updatePassword(userId, await hashPassword(input.newPassword));
      await sessions.destroyAllForUser(userId);
      return sessions.create(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

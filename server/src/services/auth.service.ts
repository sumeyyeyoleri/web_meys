import { localeFromDb, type ChangeEmailInput, type ChangePasswordInput, type LoginInput, type ResetPasswordInput } from '@painter/shared';
import { AppError } from '../domain/errors';
import { generateToken, sha256 } from '../infrastructure/crypto';
import { describeError, logger } from '../infrastructure/logger';
import { hashPassword, verifyPassword } from '../infrastructure/password-hasher';
import type { Repositories } from '../repositories';
import type { AdminUser } from '../repositories/user.repository';
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

  async function requireCurrentPassword(userId: string, password: string) {
    const user = await repos.users.findById(userId);
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', {
        currentPassword: 'validation.currentPasswordWrong',
      });
    }
  }

  return {
    /** Never reveals whether the email exists. */
    async login(input: LoginInput): Promise<AdminUser> {
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
      await requireCurrentPassword(userId, input.currentPassword);
      await repos.users.updatePassword(userId, await hashPassword(input.newPassword));
      await sessions.destroyAllForUser(userId);
      return sessions.create(userId);
    },

    /** Changes the sign-in email like the password: ends every session, returns a fresh one for this device. */
    async changeEmail(userId: string, input: ChangeEmailInput) {
      await requireCurrentPassword(userId, input.currentPassword);
      const owner = await repos.users.findByEmail(input.newEmail);
      if (owner && owner.id !== userId) {
        throw new AppError(409, 'VALIDATION_ERROR', 'This email address is already in use', { newEmail: 'validation.emailTaken' });
      }
      const user = await repos.users.updateEmail(userId, input.newEmail);
      await sessions.destroyAllForUser(userId);
      return { user, session: await sessions.create(userId) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

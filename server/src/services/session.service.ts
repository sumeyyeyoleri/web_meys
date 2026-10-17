import type { AppConfig } from '../config/env';
import { generateToken, sha256 } from '../infrastructure/crypto';
import type { Repositories } from '../repositories';
import type { UserWithProfile } from '../repositories/user.repository';

/** Sliding expiry is refreshed at most once per hour per session to limit writes. */
const SLIDE_INTERVAL_MS = 60 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  user: UserWithProfile;
  /** Present when the expiry was extended and the cookie should be re-sent. */
  renewedExpiresAt: Date | null;
}

export function createSessionService({ repos, config }: { repos: Repositories; config: Pick<AppConfig, 'sessionTtlMs'> }) {
  return {
    /** Creates a session and returns the raw token (only its hash is stored). */
    async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
      const token = generateToken(32);
      const expiresAt = new Date(Date.now() + config.sessionTtlMs);
      await repos.sessions.create({ tokenHash: sha256(token), userId, expiresAt });
      return { token, expiresAt };
    },

    async resolve(token: string): Promise<ResolvedSession | null> {
      const session = await repos.sessions.findByTokenHash(sha256(token));
      if (!session) return null;
      const now = new Date();
      if (session.expiresAt <= now) {
        await repos.sessions.deleteByTokenHash(session.tokenHash);
        return null;
      }
      let renewedExpiresAt: Date | null = null;
      if (now.getTime() - session.lastUsedAt.getTime() > SLIDE_INTERVAL_MS) {
        renewedExpiresAt = new Date(now.getTime() + config.sessionTtlMs);
        await repos.sessions.extend(session.id, renewedExpiresAt, now);
      }
      return { sessionId: session.id, user: session.user, renewedExpiresAt };
    },

    async destroy(token: string): Promise<void> {
      await repos.sessions.deleteByTokenHash(sha256(token));
    },

    async destroyAllForUser(userId: string): Promise<void> {
      await repos.sessions.deleteAllForUser(userId);
    },

    async deleteExpired(): Promise<void> {
      await repos.sessions.deleteExpired(new Date());
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

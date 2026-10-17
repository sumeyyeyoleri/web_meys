import type { PrismaClient } from '@prisma/client';
import { createAdminContentRepository } from './admin-content.repository';
import { createAdminOrderRepository } from './admin-order.repository';
import { createContentRepository } from './content.repository';
import type { Db } from './db';
import { createMessageRepository } from './message.repository';
import { createNotificationRepository } from './notification.repository';
import { createOrderRepository } from './order.repository';
import { createPasswordResetRepository } from './password-reset.repository';
import { createSessionRepository } from './session.repository';
import { createUserRepository } from './user.repository';

export function createRepositories(db: Db) {
  return {
    users: createUserRepository(db),
    sessions: createSessionRepository(db),
    passwordResets: createPasswordResetRepository(db),
    orders: createOrderRepository(db),
    messages: createMessageRepository(db),
    notifications: createNotificationRepository(db),
    content: createContentRepository(db),
    adminOrders: createAdminOrderRepository(db),
    adminContent: createAdminContentRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

/** Runs `work` in one database transaction with transaction-bound repositories. */
export type TransactionRunner = <T>(work: (repos: Repositories) => Promise<T>) => Promise<T>;

export function createTransactionRunner(prisma: PrismaClient): TransactionRunner {
  return (work) => prisma.$transaction((tx) => work(createRepositories(tx)));
}

/** True for a Prisma unique-constraint violation (optionally on a specific field). */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') return false;
  if (!field) return true;
  const target = candidate.meta?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === 'string' && target.includes(field);
}

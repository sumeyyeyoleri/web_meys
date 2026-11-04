import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config/env';
import { createMailer, type Mailer } from './infrastructure/mailer';
import { createPrismaClient } from './infrastructure/prisma';
import { createStorageDriver, type StorageDriver } from './infrastructure/storage';
import { createTranslator, type Translator } from './infrastructure/translator';
import { createRepositories, createTransactionRunner } from './repositories';
import { createAdminContentService } from './services/admin-content.service';
import { createAdminOrderService } from './services/admin-order.service';
import { createAttachmentService } from './services/attachment.service';
import { createAuthService } from './services/auth.service';
import { createContentService } from './services/content.service';
import { createEmailService } from './services/email.service';
import { createMessageService } from './services/message.service';
import { createNotificationService } from './services/notification.service';
import { createOrderService } from './services/order.service';
import { createSessionService } from './services/session.service';
import { createTrackingService } from './services/tracking.service';
import { createTranslationService } from './services/translation.service';

export interface ContainerOverrides {
  prisma?: PrismaClient;
  storage?: StorageDriver;
  mailer?: Mailer;
  translator?: Translator;
}

/** Composition root: wires infrastructure, repositories and services together. */
export function createContainer(config: AppConfig, overrides: ContainerOverrides = {}) {
  const prisma = overrides.prisma ?? createPrismaClient(config.databaseUrl);
  const storage = overrides.storage ?? createStorageDriver(config.storage);
  const mailer = overrides.mailer ?? createMailer(config.smtp);
  const translator = overrides.translator ?? createTranslator(config.deeplApiKey);
  const repos = createRepositories(prisma);
  const transaction = createTransactionRunner(prisma);

  const email = createEmailService({ mailer, repos, config });
  const sessions = createSessionService({ repos, config });
  const content = createContentService({ repos });
  const tracking = createTrackingService({ repos, transaction, email, config });
  const orders = createOrderService({ repos, transaction, storage, email, tracking });

  return {
    config,
    prisma,
    storage,
    mailer,
    services: {
      auth: createAuthService({ repos, sessions, email }),
      sessions,
      users: repos.users,
      content,
      orders,
      tracking,
      messages: createMessageService({ repos, transaction, orders, email }),
      translation: createTranslationService({ repos, orders, translator }),
      notifications: createNotificationService({ repos }),
      attachments: createAttachmentService({ repos, storage }),
      email,
      adminOrders: createAdminOrderService({ repos, transaction, orders }),
      adminContent: createAdminContentService({ repos, transaction, storage, smtpConfigured: mailer.configured }),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
export type Services = Container['services'];

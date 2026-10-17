import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../src/config/env';
import { createContainer, type Container } from '../src/container';
import { createApp } from '../src/http/app';
import { DEFAULT_RATE_LIMITS, type RateLimitConfig } from '../src/http/middleware/rate-limit';
import type { MailMessage, Mailer } from '../src/infrastructure/mailer';
import { hashPassword } from '../src/infrastructure/password-hasher';

export const ADMIN = { email: 'admin@test.local', password: 'admin-password-123' };
export const CUSTOMER_A = { email: 'anna@test.local', password: 'customer-a-password', name: 'Anna Peeters' };
export const CUSTOMER_B = { email: 'bram@test.local', password: 'customer-b-password', name: 'Bram Janssens' };

/** Records messages instead of sending them. */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  constructor(readonly configured = true) {}
  async send(message: MailMessage): Promise<boolean> {
    if (!this.configured) return false;
    this.sent.push(message);
    return true;
  }
}

const TABLES = [
  'Notification',
  'OrderStatusHistory',
  'InternalAdminNote',
  'OrderMessage',
  'OrderAttachment',
  'Order',
  'ServiceTranslation',
  'Service',
  'PortfolioItemTranslation',
  'PortfolioItem',
  'LocalizedContent',
  'SiteSettings',
  'PasswordResetToken',
  'Session',
  'CustomerProfile',
  'User',
];

const NO_LIMITS: RateLimitConfig = Object.fromEntries(
  Object.keys(DEFAULT_RATE_LIMITS).map((name) => [name, { windowMs: 60_000, limit: 10_000 }]),
) as RateLimitConfig;

export interface TestContext {
  app: Express;
  container: Container;
  prisma: PrismaClient;
  mailer: FakeMailer;
  ids: { adminId: string; customerAId: string; customerBId: string; serviceId: string; wallServiceId: string };
}

let sharedPrisma: PrismaClient | null = null;

/** One Prisma client per test file (closed in `closeTestPrisma`). */
export function testPrisma(): PrismaClient {
  sharedPrisma ??= new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  return sharedPrisma;
}

export async function closeTestPrisma() {
  await sharedPrisma?.$disconnect();
  sharedPrisma = null;
}

/** Empties every table. The safety check in test-database.ts guarantees this is the test DB. */
export async function resetDatabase(prisma: PrismaClient) {
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function createUser(
  prisma: PrismaClient,
  data: { email: string; password: string; name: string; role: 'ADMIN' | 'CUSTOMER' },
) {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      preferredLocale: 'NL_BE',
      profile: { create: { fullName: data.name } },
    },
  });
}

/** Fresh database + app for one test. */
export async function setupTest(
  options: { rateLimits?: Partial<RateLimitConfig>; mailer?: FakeMailer; settings?: { budgetRequired?: boolean; deadlineRequired?: boolean; emailNotificationsEnabled?: boolean } } = {},
): Promise<TestContext> {
  const prisma = testPrisma();
  await resetDatabase(prisma);

  await prisma.siteSettings.create({
    data: {
      id: 1,
      businessName: 'Test Atelier',
      enabledLocales: ['NL_BE', 'EN', 'TR'],
      budgetRequired: options.settings?.budgetRequired ?? false,
      deadlineRequired: options.settings?.deadlineRequired ?? false,
      emailNotificationsEnabled: options.settings?.emailNotificationsEnabled ?? true,
    },
  });
  const admin = await createUser(prisma, { ...ADMIN, name: 'Admin', role: 'ADMIN' });
  const customerA = await createUser(prisma, { ...CUSTOMER_A, role: 'CUSTOMER' });
  const customerB = await createUser(prisma, { ...CUSTOMER_B, role: 'CUSTOMER' });
  const translations = (name: string) => ({
    create: [
      { locale: 'NL_BE' as const, name: `${name} NL` },
      { locale: 'EN' as const, name: `${name} EN` },
      { locale: 'TR' as const, name: `${name} TR` },
    ],
  });
  const service = await prisma.service.create({
    data: { slug: 'canvas', isActive: true, sortOrder: 0, translations: translations('Canvas') },
  });
  const wallService = await prisma.service.create({
    data: { slug: 'mural', isActive: true, isWallService: true, sortOrder: 1, translations: translations('Mural') },
  });

  const mailer = options.mailer ?? new FakeMailer(true);
  const container = createContainer(loadConfig(), { prisma, mailer });
  const app = createApp(container, { rateLimits: { ...NO_LIMITS, ...options.rateLimits } });

  return {
    app,
    container,
    prisma,
    mailer,
    ids: {
      adminId: admin.id,
      customerAId: customerA.id,
      customerBId: customerB.id,
      serviceId: service.id,
      wallServiceId: wallService.id,
    },
  };
}

/** Cookie-keeping HTTP client that sends the CSRF header on every request. */
export class Client {
  readonly agent: ReturnType<typeof supertest.agent>;
  private csrfToken = '';

  constructor(app: Express) {
    this.agent = supertest.agent(app);
  }

  async init(): Promise<this> {
    const res = await this.agent.get('/api/auth/csrf').expect(200);
    this.csrfToken = (res.body as { csrfToken: string }).csrfToken;
    return this;
  }

  get(url: string) {
    return this.agent.get(url);
  }
  post(url: string) {
    return this.agent.post(url).set('X-CSRF-Token', this.csrfToken);
  }
  put(url: string) {
    return this.agent.put(url).set('X-CSRF-Token', this.csrfToken);
  }
  patch(url: string) {
    return this.agent.patch(url).set('X-CSRF-Token', this.csrfToken);
  }
  delete(url: string) {
    return this.agent.delete(url).set('X-CSRF-Token', this.csrfToken);
  }

  async login(credentials: { email: string; password: string }): Promise<this> {
    await this.post('/api/auth/login').send(credentials).expect(200);
    return this;
  }
}

export async function guest(app: Express) {
  return new Client(app).init();
}

export async function signedIn(app: Express, credentials: { email: string; password: string }) {
  return (await new Client(app).init()).login(credentials);
}

/* ---------- Order payloads & images ---------- */

export function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    customRequest: 'A small abstract painting for the hallway',
    width: 60,
    height: 40,
    unit: 'CM',
    title: 'Hallway painting',
    description: 'Warm earth tones, loose brushwork, something calm and quiet.',
    fullName: CUSTOMER_A.name,
    email: CUSTOMER_A.email,
    phone: '+32 470 12 34 56',
    country: 'België',
    city: 'Gent',
    postalCode: '9000',
    street: 'Veldstraat',
    houseNumber: '1',
    communicationLocale: 'nl-BE',
    privacyAccepted: true,
    ...overrides,
  };
}

export const IMAGES = {
  png: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108020000009077053e0000000c4944415478da63f8cfc000000301010018dd8db00000000049454e44ae426082', 'hex'),
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]),
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32, 0)]),
  gif: Buffer.from('474946383961010001000000002c00000000010001000002', 'hex'),
  text: Buffer.from('<html><script>alert(1)</script></html>'),
};

/** Builds the multipart order submission. */
export function submitOrder(
  client: Client,
  data: Record<string, unknown>,
  files: Array<{ buffer: Buffer; name: string; type: string }> = [],
) {
  let req = client.post('/api/orders').field('data', JSON.stringify(data));
  for (const file of files) {
    req = req.attach('files', file.buffer, { filename: file.name, contentType: file.type });
  }
  return req;
}

export const pngFile = (name = 'reference.png') => ({ buffer: IMAGES.png, name, type: 'image/png' });

/** Files currently stored in private (customer upload) storage. */
export async function privateFiles(): Promise<string[]> {
  const dir = path.join(process.env.STORAGE_LOCAL_PRIVATE_DIR!, 'orders');
  return readdir(dir).catch(() => []);
}

/** Waits for fire-and-forget work (emails) to finish. */
export async function eventually(check: () => boolean | Promise<boolean>, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Condition not met in time');
}

/** Creates an order for a signed-in customer and returns its id. */
export async function createOrderAs(client: Client, overrides: Record<string, unknown> = {}, files = [pngFile()]) {
  const res = await submitOrder(client, orderPayload(overrides), files).expect(201);
  const body = res.body as { order: { id: string; reference: string; attachments: Array<{ id: string }> } };
  return body.order;
}

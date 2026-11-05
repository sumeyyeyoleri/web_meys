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
import type { Locale } from '@painter/shared';
import type { MailMessage, Mailer } from '../src/infrastructure/mailer';
import { hashPassword } from '../src/infrastructure/password-hasher';
import { TranslatorError, type Translator } from '../src/infrastructure/translator';

export const ADMIN = { email: 'admin@test.local', password: 'admin-password-123' };
/** Contact details of the default test order (customers have no account). */
export const CUSTOMER = { name: 'Anna Peeters', email: 'anna@test.local', phone: '+32 470 12 34 56' };

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

/** Stands in for DeepL (tests never call the real service): `[tr] text`, or a DeepL error status. */
export class FakeTranslator implements Translator {
  readonly calls: Array<{ text: string; target: Locale }> = [];
  failWith: number | null = null;
  constructor(readonly configured = true) {}
  async translate(text: string, target: Locale): Promise<string> {
    this.calls.push({ text, target });
    if (this.failWith !== null) throw new TranslatorError('DeepL failed', this.failWith);
    return `[${target}] ${text}`;
  }
}

const TABLES = [
  'Notification',
  'OrderStatusHistory',
  'InternalAdminNote',
  'MessageTranslation',
  'OrderMessage',
  'OrderAttachment',
  'OrderTrackingToken',
  'Order',
  'ServiceTranslation',
  'Service',
  'PortfolioItemTranslation',
  'PortfolioItem',
  'CategoryTranslation',
  'Category',
  'LocalizedContent',
  'SiteSettings',
  'PasswordResetToken',
  'Session',
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
  translator: FakeTranslator;
  ids: { adminId: string; serviceId: string; wallServiceId: string };
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

async function createAdmin(prisma: PrismaClient) {
  return prisma.user.create({
    data: { email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password), preferredLocale: 'NL_BE' },
  });
}

/** Fresh database + app for one test. */
export async function setupTest(
  options: {
    rateLimits?: Partial<RateLimitConfig>;
    mailer?: FakeMailer;
    translator?: FakeTranslator;
    settings?: { emailNotificationsEnabled?: boolean };
  } = {},
): Promise<TestContext> {
  const prisma = testPrisma();
  await resetDatabase(prisma);

  await prisma.siteSettings.create({
    data: {
      id: 1,
      businessName: 'Test Atelier',
      enabledLocales: ['NL_BE', 'EN', 'TR'],
      emailNotificationsEnabled: options.settings?.emailNotificationsEnabled ?? true,
    },
  });
  const admin = await createAdmin(prisma);
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
  const translator = options.translator ?? new FakeTranslator(true);
  const container = createContainer(loadConfig(), { prisma, mailer, translator });
  const app = createApp(container, { rateLimits: { ...NO_LIMITS, ...options.rateLimits } });

  return {
    app,
    container,
    prisma,
    mailer,
    translator,
    ids: {
      adminId: admin.id,
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

/** A client signed in as the artist (the only account). */
export async function signedIn(app: Express, credentials: { email: string; password: string } = ADMIN) {
  return (await new Client(app).init()).login(credentials);
}

/* ---------- Order payloads & images ---------- */

export function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    width: 60,
    height: 40,
    unit: 'CM',
    description: 'Warm earth tones, loose brushwork, something calm and quiet.',
    fullName: CUSTOMER.name,
    email: CUSTOMER.email,
    phone: CUSTOMER.phone,
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

export interface CreatedOrder {
  id: string;
  reference: string;
  attachments: Array<{ id: string; url: string }>;
  /** Token of the private tracking link (`/track#<token>`). */
  token: string;
  tracking: { url: string; emailSent: boolean; expiresAt: string };
}

/** Submits an order (no account) and returns it together with its tracking token. */
export async function createOrder(client: Client, overrides: Record<string, unknown> = {}, files = [pngFile()]): Promise<CreatedOrder> {
  const res = await submitOrder(client, orderPayload(overrides), files).expect(201);
  const body = res.body as { order: Omit<CreatedOrder, 'token' | 'tracking'>; tracking: CreatedOrder['tracking'] };
  return { ...body.order, tracking: body.tracking, token: tokenFromUrl(body.tracking.url) };
}

export function tokenFromUrl(url: string): string {
  return new URL(url).hash.slice(1);
}

/** Request to a customer tracking route with the token header. */
export function track(client: Client, method: 'get' | 'post', path: string, token: string) {
  return client[method](`/api/track${path}`).set('X-Order-Token', token);
}

/**
 * Idempotent seed: running it again never duplicates rows and never overwrites
 * content that an administrator has edited since (rows are only created when missing).
 *
 * Creates: the admin (from env), one demo customer with two demo orders, 4 services,
 * 10 sample portfolio items with generated SVG artwork, all text blocks in 3 languages
 * and the default site settings.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { CONTENT_KEYS, DEFAULT_ACCENT_COLOR, LOCALES, localeToDb, PASSWORD_MIN_LENGTH } from '@painter/shared';
import { z } from 'zod';
import { hashPassword } from '../src/infrastructure/password-hasher';
import { generateArtwork } from './seed-data/art';
import { SEED_CONTENT, SEED_PORTFOLIO, SEED_SERVICES, SEED_SETTINGS } from './seed-data/content';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    ADMIN_EMAIL: z.email().transform((v) => v.toLowerCase()),
    ADMIN_PASSWORD: z.string().min(PASSWORD_MIN_LENGTH),
    SEED_DEMO_CUSTOMER_EMAIL: z.email().transform((v) => v.toLowerCase()),
    SEED_DEMO_CUSTOMER_PASSWORD: z.string().min(PASSWORD_MIN_LENGTH),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PUBLIC_DIR: z.string().default('./storage/public'),
  })
  .parse(process.env);

const prisma = new PrismaClient();
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Writes a generated file into public media storage and returns its public URL. */
async function writePublicMedia(key: string, contents: string): Promise<string> {
  if (env.STORAGE_DRIVER !== 'local') {
    throw new Error('The seed writes sample artwork to local storage. Run it with STORAGE_DRIVER=local.');
  }
  const target = path.resolve(SERVER_ROOT, env.STORAGE_LOCAL_PUBLIC_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  return `/media/${key}`;
}

async function seedUsers() {
  const admin = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: 'ADMIN',
      preferredLocale: 'NL_BE',
      profile: { create: { fullName: 'Administrator' } },
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: env.SEED_DEMO_CUSTOMER_EMAIL },
    update: {},
    create: {
      email: env.SEED_DEMO_CUSTOMER_EMAIL,
      passwordHash: await hashPassword(env.SEED_DEMO_CUSTOMER_PASSWORD),
      role: 'CUSTOMER',
      preferredLocale: 'NL_BE',
      profile: {
        create: {
          fullName: 'Demo Klant',
          phone: '+32 470 11 22 33',
          country: 'België',
          city: 'Gent',
          postalCode: '9000',
          street: 'Voorbeeldstraat',
          houseNumber: '10',
        },
      },
    },
  });

  return { admin, customer };
}

async function seedServices() {
  const services = new Map<string, string>();
  for (const [index, item] of SEED_SERVICES.entries()) {
    const imageUrl = await writePublicMedia(
      `services/${item.slug}.svg`,
      generateArtwork({ ...item.art, title: item.translations.en.name }),
    );
    const service = await prisma.service.upsert({
      where: { slug: item.slug },
      update: {},
      create: { slug: item.slug, isWallService: item.isWallService, imageUrl, sortOrder: index },
    });
    for (const locale of LOCALES) {
      const t = item.translations[locale];
      await prisma.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: service.id, locale: localeToDb(locale) } },
        update: {},
        create: { serviceId: service.id, locale: localeToDb(locale), name: t.name, description: t.description },
      });
    }
    services.set(item.slug, service.id);
  }
  return services;
}

async function seedPortfolio() {
  for (const [index, item] of SEED_PORTFOLIO.entries()) {
    const imageUrl = await writePublicMedia(
      `portfolio/${item.slug}.svg`,
      generateArtwork({
        seed: item.art.seed,
        palette: item.art.palette,
        composition: item.art.composition,
        width: item.art.portrait ? 900 : 1200,
        height: item.art.portrait ? 1200 : 900,
        title: item.translations.en.title,
      }),
    );
    const portfolioItem = await prisma.portfolioItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        category: item.category,
        imageUrl,
        width: item.width,
        height: item.height,
        unit: item.unit,
        year: item.year,
        isFeatured: item.isFeatured,
        isPublished: true,
        isSample: true,
        sortOrder: index,
      },
    });
    for (const locale of LOCALES) {
      const t = item.translations[locale];
      await prisma.portfolioItemTranslation.upsert({
        where: { portfolioItemId_locale: { portfolioItemId: portfolioItem.id, locale: localeToDb(locale) } },
        update: {},
        create: {
          portfolioItemId: portfolioItem.id,
          locale: localeToDb(locale),
          title: t.title,
          description: t.description,
        },
      });
    }
  }
}

async function seedContentAndSettings() {
  for (const key of CONTENT_KEYS) {
    for (const locale of LOCALES) {
      await prisma.localizedContent.upsert({
        where: { key_locale: { key, locale: localeToDb(locale) } },
        update: {},
        create: { key, locale: localeToDb(locale), value: SEED_CONTENT[key][locale] },
      });
    }
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ...SEED_SETTINGS,
      accentColor: DEFAULT_ACCENT_COLOR,
      enabledLocales: ['NL_BE', 'EN', 'TR'],
      budgetRequired: false,
      deadlineRequired: false,
      emailNotificationsEnabled: true,
    },
  });
}

const daysAgo = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function seedDemoOrders(adminId: string, customerId: string, services: Map<string, string>) {
  const muralId = services.get('mural');
  const portraitId = services.get('portrait');
  if (!muralId || !portraitId) throw new Error('Demo services are missing.');

  const contact = {
    contactName: 'Demo Klant',
    contactEmail: env.SEED_DEMO_CUSTOMER_EMAIL,
    contactPhone: '+32 470 11 22 33',
    communicationLocale: 'NL_BE' as const,
  };

  // Order 1 — mural, a quote has been sent; includes a message thread and an internal note.
  const quoteRef = 'ORD-2026-7K3QXM';
  if (!(await prisma.order.findUnique({ where: { reference: quoteRef } }))) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          reference: quoteRef,
          customerId,
          idempotencyKey: '7b0d9c4e-1f2a-4e3b-8c5d-6a7b8c9d0e1f',
          status: 'QUOTE_SENT',
          serviceId: muralId,
          width: new Prisma.Decimal(4.5),
          height: new Prisma.Decimal(2.6),
          unit: 'M',
          wallWidth: new Prisma.Decimal(5),
          wallHeight: new Prisma.Decimal(2.8),
          surfaceDetails: 'Gladde, geschilderde binnenmuur (latex), recent opgeschuurd.',
          title: 'Muurschildering voor de woonkamer',
          description:
            'Een rustige, abstracte zeegezichtcompositie in blauw- en zandtinten voor de grote muur in onze woonkamer.',
          colorPreferences: 'Zachte blauwtinten, zand, een accent in terracotta',
          themePreferences: 'Noordzee, kustlandschap',
          budgetMin: new Prisma.Decimal(1500),
          budgetMax: new Prisma.Decimal(3000),
          deadline: new Date('2027-04-30'),
          ...contact,
          projectCountry: 'België',
          projectCity: 'Brugge',
          projectPostalCode: '8000',
          projectStreet: 'Langestraat',
          projectHouseNumber: '45',
          privacyAcceptedAt: daysAgo(12),
          quoteAmount: new Prisma.Decimal(2450),
          quoteSentAt: daysAgo(3),
          createdAt: daysAgo(12),
        },
      });
      await tx.orderStatusHistory.createMany({
        data: [
          { orderId: order.id, fromStatus: null, toStatus: 'SUBMITTED', changedById: customerId, createdAt: daysAgo(12) },
          {
            orderId: order.id,
            fromStatus: 'SUBMITTED',
            toStatus: 'UNDER_REVIEW',
            changedById: adminId,
            createdAt: daysAgo(10),
          },
          {
            orderId: order.id,
            fromStatus: 'UNDER_REVIEW',
            toStatus: 'QUOTE_SENT',
            changedById: adminId,
            note: 'Inclusief voorbereiding van de muur en twee ontwerpschetsen.',
            quoteAmount: new Prisma.Decimal(2450),
            createdAt: daysAgo(3),
          },
        ],
      });
      await tx.orderMessage.createMany({
        data: [
          {
            orderId: order.id,
            senderId: customerId,
            senderRole: 'CUSTOMER',
            body: 'Goeiedag, is het mogelijk om ook het plafond gedeeltelijk mee te nemen in het ontwerp?',
            readAt: daysAgo(9),
            createdAt: daysAgo(10, 9),
          },
          {
            orderId: order.id,
            senderId: adminId,
            senderRole: 'ADMIN',
            body: 'Dag! Dat kan zeker. Ik werk een voorstel uit en bezorg u binnenkort een offerte.',
            readAt: daysAgo(8),
            createdAt: daysAgo(9, 14),
          },
          {
            orderId: order.id,
            senderId: adminId,
            senderRole: 'ADMIN',
            body: 'Uw offerte staat klaar in uw account. Laat gerust weten als u vragen hebt.',
            readAt: null,
            createdAt: daysAgo(3, 11),
          },
        ],
      });
      await tx.internalAdminNote.create({
        data: {
          orderId: order.id,
          authorId: adminId,
          body: 'Klant wil plafond mee in ontwerp — extra halve dag stelling voorzien.',
          createdAt: daysAgo(9, 15),
        },
      });
      await tx.notification.createMany({
        data: [
          { userId: adminId, type: 'ORDER_SUBMITTED', orderId: order.id, readAt: daysAgo(11), createdAt: daysAgo(12) },
          {
            userId: customerId,
            type: 'ORDER_STATUS_CHANGED',
            orderId: order.id,
            status: 'QUOTE_SENT',
            createdAt: daysAgo(3),
          },
          { userId: customerId, type: 'ORDER_MESSAGE', orderId: order.id, createdAt: daysAgo(3, 11) },
        ],
      });
    });
  }

  // Order 2 — portrait, freshly submitted and not yet reviewed.
  const submittedRef = 'ORD-2026-H9WPRT';
  if (!(await prisma.order.findUnique({ where: { reference: submittedRef } }))) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          reference: submittedRef,
          customerId,
          idempotencyKey: '2c4e6a8b-0d1f-4a3c-9e5b-7d9f1b3d5f7a',
          status: 'SUBMITTED',
          serviceId: portraitId,
          width: new Prisma.Decimal(50),
          height: new Prisma.Decimal(70),
          unit: 'CM',
          title: 'Portret van onze hond',
          description: 'Een portret van onze hond Bo, in een losse schilderstijl met een warme achtergrond.',
          stylePreferences: 'Expressief, zichtbare penseelstreken',
          ...contact,
          projectCountry: 'België',
          projectCity: 'Gent',
          projectPostalCode: '9000',
          projectStreet: 'Voorbeeldstraat',
          projectHouseNumber: '10',
          privacyAcceptedAt: daysAgo(1),
          createdAt: daysAgo(1),
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: null, toStatus: 'SUBMITTED', changedById: customerId, createdAt: daysAgo(1) },
      });
      await tx.notification.create({
        data: { userId: adminId, type: 'ORDER_SUBMITTED', orderId: order.id, createdAt: daysAgo(1) },
      });
    });
  }
}

async function main() {
  const { admin, customer } = await seedUsers();
  const services = await seedServices();
  await seedPortfolio();
  await seedContentAndSettings();
  await seedDemoOrders(admin.id, customer.id, services);

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.service.count(),
    prisma.portfolioItem.count(),
    prisma.localizedContent.count(),
    prisma.order.count(),
  ]);
  console.log(
    `Seed complete: ${counts[0]} users, ${counts[1]} services, ${counts[2]} portfolio items, ${counts[3]} text blocks, ${counts[4]} orders.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { Prisma } from '@prisma/client';
import {
  buildCreateOrderSchema,
  localeToDb,
  todayIsoDate,
  type CreateOrderInput,
  type OrderStatus,
  type StatusActor,
} from '@painter/shared';
import { AppError, forbidden, notFound, validationError } from '../domain/errors';
import { generateOrderReference } from '../domain/order-reference';
import { assertStatusTransition } from '../domain/order-status';
import { describeError, logger } from '../infrastructure/logger';
import { hashPassword } from '../infrastructure/password-hasher';
import type { StorageDriver } from '../infrastructure/storage';
import { isUniqueViolation, type Repositories, type TransactionRunner } from '../repositories';
import type { OrderWithDetail } from '../repositories/order.repository';
import type { UserWithProfile } from '../repositories/user.repository';
import type { ContentService } from './content.service';
import type { EmailService } from './email.service';
import { notificationRecorder } from './notification.service';
import { validateImages, type IncomingFile, type ValidatedImage } from './upload-validation';

const MAX_REFERENCE_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Actor {
  id: string;
  role: StatusActor;
}

export interface CreateOrderParams {
  user: UserWithProfile | null;
  /** The `data` multipart field: JSON text. */
  rawData: unknown;
  files: IncomingFile[];
}

export interface CreateOrderResult {
  order: OrderWithDetail;
  user: UserWithProfile;
  /** False when an identical submission (same idempotency key) already existed. */
  created: boolean;
  /** True when a new account was created; the caller should start a session for it. */
  accountCreated: boolean;
}

export interface StatusChangeParams {
  orderId: string;
  actor: Actor;
  status: OrderStatus;
  quoteAmount?: number;
  note?: string;
}

interface Deps {
  repos: Repositories;
  transaction: TransactionRunner;
  storage: StorageDriver;
  email: EmailService;
  content: ContentService;
}

const dec = (value: number | undefined) => (value === undefined ? null : new Prisma.Decimal(value));

function parseJsonField(raw: unknown): unknown {
  if (typeof raw !== 'string') throw validationError({ data: 'validation.required' });
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw validationError({ data: 'validation.invalid' });
  }
}

function orderData(input: CreateOrderInput, customerId: string, reference: string): Prisma.OrderUncheckedCreateInput {
  return {
    reference,
    customerId,
    idempotencyKey: input.idempotencyKey,
    status: 'SUBMITTED',
    serviceId: input.serviceId ?? null,
    customRequest: input.customRequest ?? null,
    inspirationItemId: input.inspirationItemId ?? null,
    // Only meaningful relative to an example; ignored without one.
    additionalSpecs: input.inspirationItemId ? (input.additionalSpecs ?? null) : null,
    width: new Prisma.Decimal(input.width),
    height: new Prisma.Decimal(input.height),
    unit: input.unit,
    wallWidth: dec(input.wallWidth),
    wallHeight: dec(input.wallHeight),
    surfaceDetails: input.surfaceDetails ?? null,
    extraSpecifications: input.extraSpecifications ?? null,
    title: input.title,
    description: input.description,
    stylePreferences: input.stylePreferences ?? null,
    colorPreferences: input.colorPreferences ?? null,
    themePreferences: input.themePreferences ?? null,
    budgetMin: dec(input.budgetMin),
    budgetMax: dec(input.budgetMax),
    deadline: input.deadline ? new Date(`${input.deadline}T00:00:00Z`) : null,
    extraInstructions: input.extraInstructions ?? null,
    contactName: input.fullName,
    contactEmail: input.email,
    contactPhone: input.phone,
    communicationLocale: localeToDb(input.communicationLocale),
    projectCountry: input.country,
    projectCity: input.city,
    projectPostalCode: input.postalCode,
    projectStreet: input.street,
    projectHouseNumber: input.houseNumber,
    projectAddressExtra: input.addressExtra ?? null,
    privacyAcceptedAt: new Date(),
  };
}

export function createOrderService({ repos, transaction, storage, email, content }: Deps) {
  async function storeFiles(images: ValidatedImage[]): Promise<string[]> {
    const stored: string[] = [];
    try {
      for (const image of images) {
        await storage.putPrivate(image.storageKey, image.buffer, image.mimeType);
        stored.push(image.storageKey);
      }
      return stored;
    } catch (error) {
      await removeFiles(stored);
      throw error;
    }
  }

  async function removeFiles(keys: string[]) {
    await Promise.all(
      keys.map((key) =>
        storage.deletePrivate(key).catch((error: unknown) => logger.error('Failed to remove orphaned upload', describeError(error))),
      ),
    );
  }

  async function uniqueReference(txRepos: Repositories): Promise<string> {
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateOrderReference();
      if (!(await txRepos.orders.referenceExists(reference))) return reference;
    }
    throw new Error('Could not generate a unique order reference');
  }

  async function loadOrder(orderId: string, actor: Actor): Promise<OrderWithDetail> {
    const order =
      actor.role === 'ADMIN'
        ? await repos.orders.findById(orderId)
        : await repos.orders.findForCustomer(orderId, actor.id);
    // Other customers' orders are reported as "not found", never "forbidden".
    if (!order) throw notFound('Order not found');
    return order;
  }

  return {
    loadOrder,

    async create({ user, rawData, files }: CreateOrderParams): Promise<CreateOrderResult> {
      if (user?.role === 'ADMIN') throw forbidden('Administrators cannot submit orders');
      const settings = await content.requireSettings();
      const isGuest = user === null;
      // One day of tolerance so customers in time zones behind the server are not rejected.
      const today = todayIsoDate(new Date(Date.now() - DAY_MS));
      const input = buildCreateOrderSchema({
        isGuest,
        budgetRequired: settings.budgetRequired,
        deadlineRequired: settings.deadlineRequired,
        today,
      }).parse(parseJsonField(rawData)) as CreateOrderInput;

      if (user) {
        const existing = await repos.orders.findByIdempotencyKey(user.id, input.idempotencyKey);
        if (existing) return { order: existing, user, created: false, accountCreated: false };
      } else if (await repos.users.findByEmail(input.email)) {
        throw new AppError(409, 'ACCOUNT_EXISTS_LOGIN_REQUIRED', 'An account with this email exists. Please log in.', {
          email: 'validation.accountExistsLogin',
        });
      }

      if (input.serviceId) {
        const service = await repos.content.findService(input.serviceId);
        if (!service?.isActive) throw validationError({ serviceId: 'validation.invalidOption' });
      }
      if (input.inspirationItemId) {
        const item = await repos.content.findPortfolioItem(input.inspirationItemId);
        if (!item?.isPublished || !item.allowSimilarRequest) {
          throw validationError({ inspirationItemId: 'validation.invalidInspiration' });
        }
      }

      const images = validateImages(files, 'orders');
      const passwordHash = isGuest ? await hashPassword(input.password ?? '') : null;
      const storedKeys = await storeFiles(images);

      try {
        const { orderId, customer, adminRecipients } = await transaction(async (tx) => {
          const customer =
            user ??
            (await tx.users.create({
              email: input.email,
              passwordHash: passwordHash ?? '',
              role: 'CUSTOMER',
              preferredLocale: localeToDb(input.communicationLocale),
              profile: {
                fullName: input.fullName,
                phone: input.phone,
                country: input.country,
                city: input.city,
                postalCode: input.postalCode,
                street: input.street,
                houseNumber: input.houseNumber,
                addressExtra: input.addressExtra ?? null,
              },
            }));
          const order = await tx.orders.create(orderData(input, customer.id, await uniqueReference(tx)));
          await tx.orders.createAttachments(
            images.map((image) => ({
              orderId: order.id,
              storageKey: image.storageKey,
              originalName: image.originalName,
              mimeType: image.mimeType,
              sizeBytes: image.size,
            })),
          );
          await tx.orders.addStatusHistory({
            orderId: order.id,
            fromStatus: null,
            toStatus: 'SUBMITTED',
            changedById: customer.id,
          });
          const adminRecipients = await notificationRecorder.orderSubmitted(tx, order);
          return { orderId: order.id, customer, adminRecipients };
        });

        const order = await repos.orders.findById(orderId);
        if (!order) throw new Error('Order disappeared after creation');
        void email.sendOrderSubmitted(adminRecipients, order);
        return { order, user: customer, created: true, accountCreated: isGuest };
      } catch (error) {
        await removeFiles(storedKeys);
        if (user && isUniqueViolation(error, 'idempotencyKey')) {
          // A concurrent duplicate submission won the race: return that order.
          const existing = await repos.orders.findByIdempotencyKey(user.id, input.idempotencyKey);
          if (existing) return { order: existing, user, created: false, accountCreated: false };
        }
        if (!user && isUniqueViolation(error, 'email')) {
          throw new AppError(409, 'ACCOUNT_EXISTS_LOGIN_REQUIRED', 'An account with this email exists. Please log in.', {
            email: 'validation.accountExistsLogin',
          });
        }
        throw error;
      }
    },

    async listForCustomer(customerId: string, page: number, pageSize: number) {
      const { items, total } = await repos.orders.listForCustomer(customerId, (page - 1) * pageSize, pageSize);
      const unread = await repos.orders.unreadMessageCounts(
        items.map((o) => o.id),
        'ADMIN',
      );
      return { items, total, unread };
    },

    async getForViewer(orderId: string, actor: Actor) {
      const order = await loadOrder(orderId, actor);
      const unread = await repos.orders.unreadMessageCounts([order.id], actor.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN');
      return { order, unreadMessages: unread.get(order.id) ?? 0 };
    },

    /** Status change for customers (accept/cancel) and administrators; rules live in packages/shared. */
    async changeStatus({ orderId, actor, status, quoteAmount, note }: StatusChangeParams): Promise<OrderWithDetail> {
      const order = await loadOrder(orderId, actor);
      if (order.archivedAt) {
        throw new AppError(409, 'ORDER_INVALID_TRANSITION', 'Archived orders cannot change status');
      }
      assertStatusTransition(order.status, status, actor.role, quoteAmount);
      const sendingQuote = status === 'QUOTE_SENT';

      const recipients = await transaction(async (tx) => {
        const updated = await tx.orders.updateStatusIfCurrent(order.id, order.status, {
          status,
          ...(sendingQuote ? { quoteAmount: new Prisma.Decimal(quoteAmount ?? 0), quoteSentAt: new Date() } : {}),
        });
        if (!updated) {
          throw new AppError(409, 'ORDER_INVALID_TRANSITION', 'The order status was changed in the meantime');
        }
        await tx.orders.addStatusHistory({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          changedById: actor.id,
          note: note ?? null,
          quoteAmount: sendingQuote ? new Prisma.Decimal(quoteAmount ?? 0) : null,
        });
        return notificationRecorder.statusChanged(tx, order, actor.role, status);
      });

      void email.sendStatusChanged(recipients, order, status);
      return loadOrder(orderId, actor);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;

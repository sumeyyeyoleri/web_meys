import { Prisma } from '@prisma/client';
import {
  createOrderSchema,
  localeToDb,
  type CreateOrderInput,
  type Locale,
  type OrderStatus,
  type StatusActor,
} from '@painter/shared';
import { pickTranslation } from '../domain/localization';
import { AppError, forbidden, notFound, validationError } from '../domain/errors';
import { generateOrderReference } from '../domain/order-reference';
import { assertStatusTransition } from '../domain/order-status';
import { describeError, logger } from '../infrastructure/logger';
import type { StorageDriver } from '../infrastructure/storage';
import { isUniqueViolation, type Repositories, type TransactionRunner } from '../repositories';
import type { OrderWithDetail } from '../repositories/order.repository';
import type { UserWithProfile } from '../repositories/user.repository';
import type { EmailService } from './email.service';
import { notificationRecorder } from './notification.service';
import type { TrackingLinkResult, TrackingService } from './tracking.service';
import { validateImages, type IncomingFile, type ValidatedImage } from './upload-validation';

const MAX_REFERENCE_ATTEMPTS = 5;
const TITLE_MAX_LENGTH = 80;

/**
 * Who acts on an order: a signed-in user, or a guest holding the private tracking link of
 * exactly one order (`trackedOrderId`, resolved from the token — never from the URL).
 */
export type Actor = { id: string; role: StatusActor } | { id: null; role: 'CUSTOMER'; trackedOrderId: string };

export const guestActor = (trackedOrderId: string): Actor => ({ id: null, role: 'CUSTOMER', trackedOrderId });

export interface CreateOrderParams {
  user: UserWithProfile | null;
  /** The `data` multipart field: JSON text. */
  rawData: unknown;
  files: IncomingFile[];
}

export interface CreateOrderResult {
  order: OrderWithDetail;
  /** False when an identical submission (same idempotency key) already existed. */
  created: boolean;
  /** Guest orders only. */
  tracking: TrackingLinkResult | null;
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
  tracking: TrackingService;
}

function parseJsonField(raw: unknown): unknown {
  if (typeof raw !== 'string') throw validationError({ data: 'validation.required' });
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw validationError({ data: 'validation.invalid' });
  }
}

/** First words of the description, cut at a word boundary. */
function titleFromDescription(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (text.length <= TITLE_MAX_LENGTH) return text;
  const cut = text.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

function orderData(
  input: CreateOrderInput,
  customerId: string | null,
  reference: string,
  title: string,
): Prisma.OrderUncheckedCreateInput {
  return {
    reference,
    customerId,
    idempotencyKey: input.idempotencyKey,
    status: 'SUBMITTED',
    serviceId: input.serviceId ?? null,
    inspirationItemId: input.inspirationItemId ?? null,
    width: new Prisma.Decimal(input.width),
    height: new Prisma.Decimal(input.height),
    unit: input.unit,
    title,
    description: input.description,
    contactName: input.fullName,
    contactEmail: input.email,
    contactPhone: input.phone ?? null,
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

export function createOrderService({ repos, transaction, storage, email, tracking }: Deps) {
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

  async function findVisible(orderId: string, actor: Actor): Promise<OrderWithDetail | null> {
    if (actor.role === 'ADMIN') return repos.orders.findById(orderId);
    if (actor.id !== null) return repos.orders.findForCustomer(orderId, actor.id);
    if (orderId !== actor.trackedOrderId) return null;
    const order = await repos.orders.findById(orderId);
    return order && order.customerId === null ? order : null;
  }

  async function loadOrder(orderId: string, actor: Actor): Promise<OrderWithDetail> {
    const order = await findVisible(orderId, actor);
    // Other people's orders are reported as "not found", never "forbidden".
    if (!order) throw notFound('Order not found');
    return order;
  }

  /**
   * Same idempotency key again (double click, retried request): return the original order.
   * For a guest a fresh tracking link is issued — the random key proves it is the same submitter,
   * and the first link (possibly lost with the first response) stays valid.
   */
  async function repeatedSubmission(existing: OrderWithDetail, customerId: string | null, email: string): Promise<CreateOrderResult> {
    if (existing.customerId !== customerId || (customerId === null && existing.contactEmail !== email)) {
      throw new AppError(409, 'CONFLICT', 'This submission key was already used');
    }
    if (customerId) return { order: existing, created: false, tracking: null };
    const link = await transaction((tx) => tracking.issue(tx, existing.id));
    return { order: existing, created: false, tracking: { ...link, emailSent: false } };
  }

  return {
    loadOrder,

    async create({ user, rawData, files }: CreateOrderParams): Promise<CreateOrderResult> {
      if (user?.role === 'ADMIN') throw forbidden('Administrators cannot submit orders');
      const input = createOrderSchema.parse(parseJsonField(rawData));
      // A guest order is never linked to an account, not even one with the same email (privacy).
      const customerId = user?.id ?? null;

      const existing = await repos.orders.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return repeatedSubmission(existing, customerId, input.email);

      const locale: Locale = input.communicationLocale;
      let title = '';
      if (input.inspirationItemId) {
        const item = await repos.content.findPortfolioItem(input.inspirationItemId);
        if (!item?.isPublished || !item.allowSimilarRequest) {
          throw validationError({ inspirationItemId: 'validation.invalidInspiration' });
        }
        title = pickTranslation(item.translations, locale)?.title ?? '';
      }
      if (input.serviceId) {
        const service = await repos.content.findService(input.serviceId);
        if (!service?.isActive) throw validationError({ serviceId: 'validation.invalidOption' });
        title ||= pickTranslation(service.translations, locale)?.name ?? '';
      }
      title ||= titleFromDescription(input.description);

      const images = validateImages(files, 'orders');
      const storedKeys = await storeFiles(images);

      try {
        const { orderId, link, adminRecipients } = await transaction(async (tx) => {
          const order = await tx.orders.create(orderData(input, customerId, await uniqueReference(tx), title));
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
            changedById: customerId,
            changedByRole: 'CUSTOMER',
          });
          const link = customerId ? null : await tracking.issue(tx, order.id);
          const adminRecipients = await notificationRecorder.orderSubmitted(tx, order);
          return { orderId: order.id, link, adminRecipients };
        });

        const order = await repos.orders.findById(orderId);
        if (!order) throw new Error('Order disappeared after creation');
        void email.sendOrderSubmitted(adminRecipients, order);
        // Awaited: the confirmation page may only say "emailed" when the email was accepted.
        const trackingResult = link ? { ...link, emailSent: await tracking.sendLink(order, link.url) } : null;
        return { order, created: true, tracking: trackingResult };
      } catch (error) {
        await removeFiles(storedKeys);
        if (isUniqueViolation(error, 'idempotencyKey')) {
          // A concurrent duplicate submission won the race: return that order.
          const winner = await repos.orders.findByIdempotencyKey(input.idempotencyKey);
          if (winner) return repeatedSubmission(winner, customerId, input.email);
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
          changedByRole: actor.role,
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

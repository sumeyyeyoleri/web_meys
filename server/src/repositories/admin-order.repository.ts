import type { OrderStatus, Prisma } from '@prisma/client';
import type { Db } from './db';
import { orderSummaryInclude } from './order.repository';

export interface AdminOrderFilter {
  status?: OrderStatus;
  /** Inclusive `YYYY-MM-DD` bounds on the creation date (UTC). */
  from?: string;
  to?: string;
  q?: string;
  includeArchived?: boolean;
}

export const adminOrderSummaryInclude = {
  ...orderSummaryInclude,
  customer: { select: { email: true } },
} as const satisfies Prisma.OrderInclude;

export type AdminOrderWithSummary = Prisma.OrderGetPayload<{ include: typeof adminOrderSummaryInclude }>;

function buildWhere(filter: AdminOrderFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (!filter.includeArchived) where.archivedAt = null;
  if (filter.status) where.status = filter.status;
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
      // `to` is inclusive: everything before the start of the next day.
      ...(filter.to ? { lt: new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }
  if (filter.q) {
    const contains = { contains: filter.q, mode: 'insensitive' as const };
    const digits = filter.q.replace(/\D/g, '');
    where.OR = [
      { reference: contains },
      { contactName: contains },
      { contactEmail: contains },
      { contactPhone: contains },
      { customer: { email: contains } },
      { customer: { profile: { fullName: contains } } },
      ...(digits.length >= 4 ? [{ contactPhone: { contains: digits } }] : []),
    ];
  }
  return where;
}

export function createAdminOrderRepository(db: Db) {
  return {
    async list(filter: AdminOrderFilter, skip: number, take: number) {
      const where = buildWhere(filter);
      const [items, total] = await Promise.all([
        db.order.findMany({ where, include: adminOrderSummaryInclude, orderBy: { createdAt: 'desc' }, skip, take }),
        db.order.count({ where }),
      ]);
      return { items, total };
    },

    findCustomerEmail(orderId: string) {
      return db.order.findUnique({ where: { id: orderId }, select: { customer: { select: { email: true } } } });
    },

    update(id: string, data: Prisma.OrderUncheckedUpdateInput) {
      return db.order.update({ where: { id }, data });
    },

    /** Archives only if the order is still unarchived and in one of `statuses`. */
    async archiveIf(id: string, statuses: OrderStatus[], now: Date): Promise<boolean> {
      const result = await db.order.updateMany({
        where: { id, archivedAt: null, status: { in: statuses } },
        data: { archivedAt: now },
      });
      return result.count === 1;
    },

    async countByStatus(): Promise<Map<OrderStatus, number>> {
      const rows = await db.order.groupBy({ by: ['status'], _count: { _all: true } });
      return new Map(rows.map((row) => [row.status, row._count._all]));
    },

    countAll() {
      return db.order.count();
    },

    recent(take: number) {
      return db.order.findMany({
        where: { archivedAt: null },
        include: adminOrderSummaryInclude,
        orderBy: { createdAt: 'desc' },
        take,
      });
    },

    countUnreadCustomerMessages() {
      return db.orderMessage.count({ where: { senderRole: 'CUSTOMER', readAt: null } });
    },

    recentCustomerMessages(take: number) {
      return db.orderMessage.findMany({
        where: { senderRole: 'CUSTOMER' },
        orderBy: { createdAt: 'desc' },
        take,
        include: { order: { select: { reference: true, contactName: true } } },
      });
    },

    listNotes(orderId: string) {
      return db.internalAdminNote.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { email: true } } },
      });
    },

    createNote(data: { orderId: string; authorId: string; body: string }) {
      return db.internalAdminNote.create({ data, include: { author: { select: { email: true } } } });
    },
  };
}

export type AdminOrderRepository = ReturnType<typeof createAdminOrderRepository>;
export type InternalNoteWithAuthor = Awaited<ReturnType<AdminOrderRepository['createNote']>>;
export type RecentCustomerMessage = Awaited<ReturnType<AdminOrderRepository['recentCustomerMessages']>>[number];

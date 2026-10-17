import type { OrderStatus, Prisma, Role } from '@prisma/client';
import type { Db } from './db';

export const orderDetailInclude = {
  service: { include: { translations: true } },
  inspirationItem: { include: { translations: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' }, include: { changedBy: { select: { role: true } } } },
} as const satisfies Prisma.OrderInclude;

export const orderSummaryInclude = {
  service: { include: { translations: true } },
} as const satisfies Prisma.OrderInclude;

export type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;
export type OrderWithSummary = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export function createOrderRepository(db: Db) {
  return {
    findById(id: string) {
      return db.order.findUnique({ where: { id }, include: orderDetailInclude });
    },

    /** Returns the order only if it belongs to the customer (otherwise null → 404). */
    findForCustomer(id: string, customerId: string) {
      return db.order.findFirst({ where: { id, customerId }, include: orderDetailInclude });
    },

    findByIdempotencyKey(customerId: string, idempotencyKey: string) {
      return db.order.findUnique({
        where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
        include: orderDetailInclude,
      });
    },

    async referenceExists(reference: string): Promise<boolean> {
      return (await db.order.count({ where: { reference } })) > 0;
    },

    create(data: Prisma.OrderUncheckedCreateInput) {
      return db.order.create({ data });
    },

    createAttachments(data: Prisma.OrderAttachmentCreateManyInput[]) {
      return db.orderAttachment.createMany({ data });
    },

    addStatusHistory(data: Prisma.OrderStatusHistoryUncheckedCreateInput) {
      return db.orderStatusHistory.create({ data });
    },

    /**
     * Optimistic update: only succeeds while the order still has `from` status,
     * so two concurrent changes cannot both apply.
     */
    async updateStatusIfCurrent(
      id: string,
      from: OrderStatus,
      data: Pick<Prisma.OrderUpdateManyMutationInput, 'status' | 'quoteAmount' | 'quoteSentAt'>,
    ): Promise<boolean> {
      const result = await db.order.updateMany({ where: { id, status: from }, data });
      return result.count === 1;
    },

    async listForCustomer(customerId: string, skip: number, take: number) {
      const where = { customerId };
      const [items, total] = await Promise.all([
        db.order.findMany({ where, include: orderSummaryInclude, orderBy: { createdAt: 'desc' }, skip, take }),
        db.order.count({ where }),
      ]);
      return { items, total };
    },

    /** Unread messages per order written by the given sender role. */
    async unreadMessageCounts(orderIds: string[], senderRole: Role): Promise<Map<string, number>> {
      if (orderIds.length === 0) return new Map();
      const rows = await db.orderMessage.groupBy({
        by: ['orderId'],
        where: { orderId: { in: orderIds }, senderRole, readAt: null },
        _count: { _all: true },
      });
      return new Map(rows.map((row) => [row.orderId, row._count._all]));
    },

    findAttachmentWithOwner(id: string) {
      return db.orderAttachment.findUnique({
        where: { id },
        include: { order: { select: { customerId: true } } },
      });
    },
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;

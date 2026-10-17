import { Prisma } from '@prisma/client';
import { localeToDb, TERMINAL_STATUSES, type AdminOrderListQuery, type AdminOrderUpdateInput } from '@painter/shared';
import { AppError, notFound, validationError } from '../domain/errors';
import type { Repositories, TransactionRunner } from '../repositories';
import type { OrderService } from './order.service';

const RECENT_LIMIT = 5;
const dec = (value: number | undefined) => (value === undefined ? null : new Prisma.Decimal(value));

export function createAdminOrderService({
  repos,
  transaction,
  orders,
}: {
  repos: Repositories;
  transaction: TransactionRunner;
  orders: OrderService;
}) {
  async function requireOrder(id: string) {
    const order = await repos.orders.findById(id);
    if (!order) throw notFound('Order not found');
    return order;
  }

  async function detail(id: string) {
    const order = await requireOrder(id);
    const [notes, owner, unread] = await Promise.all([
      repos.adminOrders.listNotes(id),
      repos.adminOrders.findCustomerEmail(id),
      repos.orders.unreadMessageCounts([id], 'CUSTOMER'),
    ]);
    return { order, notes, customerAccountEmail: owner?.customer.email ?? '', unreadMessages: unread.get(id) ?? 0 };
  }

  return {
    detail,

    async list(query: AdminOrderListQuery) {
      const { page, pageSize, ...filter } = query;
      const { items, total } = await repos.adminOrders.list(filter, (page - 1) * pageSize, pageSize);
      const unread = await repos.orders.unreadMessageCounts(
        items.map((o) => o.id),
        'CUSTOMER',
      );
      return { items, total, unread };
    },

    /** Corrects the submitted order data. Archived orders are read-only. */
    async update(id: string, input: AdminOrderUpdateInput) {
      const order = await requireOrder(id);
      if (order.archivedAt) throw new AppError(409, 'CONFLICT', 'Archived orders cannot be edited');
      if (input.serviceId && input.serviceId !== order.serviceId) {
        if (!(await repos.content.findService(input.serviceId))) throw validationError({ serviceId: 'validation.invalidOption' });
      }
      await repos.adminOrders.update(id, {
        serviceId: input.serviceId ?? null,
        customRequest: input.customRequest ?? null,
        additionalSpecs: input.additionalSpecs ?? null,
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
      });
      return detail(id);
    },

    /** Only COMPLETED or CANCELLED orders can be archived; orders are never deleted. */
    async archive(id: string) {
      const order = await requireOrder(id);
      if (order.archivedAt) return detail(id);
      const archived = await repos.adminOrders.archiveIf(id, [...TERMINAL_STATUSES], new Date());
      if (!archived) throw new AppError(409, 'ORDER_NOT_ARCHIVABLE', 'Only completed or cancelled orders can be archived');
      return detail(id);
    },

    async listNotes(orderId: string) {
      await requireOrder(orderId);
      return repos.adminOrders.listNotes(orderId);
    },

    async addNote(orderId: string, authorId: string, body: string) {
      await requireOrder(orderId);
      return repos.adminOrders.createNote({ orderId, authorId, body });
    },

    changeStatus: orders.changeStatus,

    async stats() {
      const [byStatus, totalOrders, unreadCustomerMessages, recentOrders, recentMessages] = await transaction((tx) =>
        Promise.all([
          tx.adminOrders.countByStatus(),
          tx.adminOrders.countAll(),
          tx.adminOrders.countUnreadCustomerMessages(),
          tx.adminOrders.recent(RECENT_LIMIT),
          tx.adminOrders.recentCustomerMessages(RECENT_LIMIT),
        ]),
      );
      const count = (...statuses: Parameters<typeof byStatus.get>[0][]) =>
        statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0);
      const unread = await repos.orders.unreadMessageCounts(
        recentOrders.map((o) => o.id),
        'CUSTOMER',
      );
      return {
        totalOrders,
        newOrders: count('SUBMITTED'),
        inReview: count('UNDER_REVIEW', 'AWAITING_CUSTOMER_INFO', 'QUOTE_SENT'),
        inProgress: count('ACCEPTED', 'IN_PROGRESS'),
        completed: count('COMPLETED'),
        unreadCustomerMessages,
        recentOrders,
        recentOrdersUnread: unread,
        recentMessages,
      };
    },
  };
}

export type AdminOrderService = ReturnType<typeof createAdminOrderService>;

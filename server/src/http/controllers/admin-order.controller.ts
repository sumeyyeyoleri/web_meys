import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  adminOrderListQuerySchema,
  adminOrderUpdateSchema,
  adminStatusChangeSchema,
  internalNoteSchema,
  isLocale,
  localeFromDb,
  messageBodySchema,
  type AdminStatsDto,
  type Locale,
} from '@painter/shared';
import type { Services } from '../../container';
import { toIso, toIsoOrNull, paginate } from '../mappers/common';
import { toAdminOrderDetailDto, toAdminOrderSummaryDto, toInternalNoteDto } from '../mappers/admin.mapper';
import { toMessageDto } from '../mappers/message.mapper';
import { getAuth } from '../middleware/auth';
import { parseBody, parseIdParam, parseQuery } from '../middleware/validation';

function adminLocale(req: Request): Locale {
  const requested = req.query.locale;
  if (isLocale(requested)) return requested;
  return localeFromDb(getAuth(req).user.preferredLocale);
}

const listQuery = adminOrderListQuerySchema.extend({ locale: z.string().optional() });

export function createAdminOrderController({ adminOrders, messages, content }: Services) {
  const actorOf = (req: Request) => ({ id: getAuth(req).user.id, role: 'ADMIN' as const });

  async function sendDetail(req: Request, res: Response, id: string) {
    res.json(toAdminOrderDetailDto(await adminOrders.detail(id), adminLocale(req)));
  }

  return {
    async stats(req: Request, res: Response) {
      const stats = await adminOrders.stats();
      const locale = adminLocale(req);
      const body: AdminStatsDto = {
        totalOrders: stats.totalOrders,
        newOrders: stats.newOrders,
        inReview: stats.inReview,
        inProgress: stats.inProgress,
        completed: stats.completed,
        unreadCustomerMessages: stats.unreadCustomerMessages,
        recentOrders: stats.recentOrders.map((o) => toAdminOrderSummaryDto(o, locale, stats.recentOrdersUnread.get(o.id) ?? 0)),
        recentMessages: stats.recentMessages.map((m) => ({
          id: m.id,
          orderId: m.orderId,
          orderReference: m.order.reference,
          customerName: m.order.contactName,
          body: m.body,
          readAt: toIsoOrNull(m.readAt),
          createdAt: toIso(m.createdAt),
        })),
      };
      res.json(body);
    },

    async list(req: Request, res: Response) {
      const { locale: _locale, ...query } = parseQuery(listQuery, req);
      const { items, total, unread } = await adminOrders.list(query);
      const locale = adminLocale(req);
      res.json(
        paginate(
          items.map((o) => toAdminOrderSummaryDto(o, locale, unread.get(o.id) ?? 0)),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },

    async detail(req: Request, res: Response) {
      await sendDetail(req, res, parseIdParam(req));
    },

    async update(req: Request, res: Response) {
      const id = parseIdParam(req);
      const input = parseBody(adminOrderUpdateSchema, req);
      res.json(toAdminOrderDetailDto(await adminOrders.update(id, input), adminLocale(req)));
    },

    async changeStatus(req: Request, res: Response) {
      const id = parseIdParam(req);
      const input = parseBody(adminStatusChangeSchema, req);
      await adminOrders.changeStatus({ orderId: id, actor: actorOf(req), ...input });
      await sendDetail(req, res, id);
    },

    async archive(req: Request, res: Response) {
      res.json(toAdminOrderDetailDto(await adminOrders.archive(parseIdParam(req)), adminLocale(req)));
    },

    async listNotes(req: Request, res: Response) {
      const notes = await adminOrders.listNotes(parseIdParam(req));
      res.json(notes.map(toInternalNoteDto));
    },

    async addNote(req: Request, res: Response) {
      const id = parseIdParam(req);
      const { body } = parseBody(internalNoteSchema, req);
      res.status(201).json(toInternalNoteDto(await adminOrders.addNote(id, getAuth(req).user.id, body)));
    },

    async listMessages(req: Request, res: Response) {
      const viewer = actorOf(req);
      const [items, settings] = await Promise.all([messages.list(parseIdParam(req), viewer), content.requireSettings()]);
      res.json(items.map((m) => toMessageDto(m, viewer.id, settings.businessName)));
    },

    async sendMessage(req: Request, res: Response) {
      const viewer = actorOf(req);
      const { body } = parseBody(messageBodySchema, req);
      const [message, settings] = await Promise.all([
        messages.send(parseIdParam(req), viewer, body),
        content.requireSettings(),
      ]);
      res.status(201).json(toMessageDto(message, viewer.id, settings.businessName));
    },

    async markMessagesRead(req: Request, res: Response) {
      await messages.markRead(parseIdParam(req), actorOf(req));
      res.status(204).end();
    },
  };
}

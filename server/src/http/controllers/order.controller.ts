import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  customerOrderListQuerySchema,
  customerStatusActionSchema,
  isLocale,
  localeFromDb,
  messageBodySchema,
  type CreateOrderResultDto,
  type Locale,
} from '@painter/shared';
import type { Container } from '../../container';
import { paginate, toIso } from '../mappers/common';
import { toMessageDto } from '../mappers/message.mapper';
import { toOrderDetailDto, toOrderSummaryDto } from '../mappers/order.mapper';
import { getAuth } from '../middleware/auth';
import { incomingFiles } from '../middleware/upload';
import { parseBody, parseIdParam, parseQuery } from '../middleware/validation';
import type { RequestAuth } from '../types';

/** Display language for service names: `?locale=` or the user's preferred language. */
function displayLocale(req: Request, auth: RequestAuth | undefined): Locale {
  const requested = req.query.locale;
  if (isLocale(requested)) return requested;
  return auth ? localeFromDb(auth.user.preferredLocale) : 'nl-BE';
}

const listQuery = customerOrderListQuerySchema.extend({ locale: z.string().optional() });

export function createOrderController({ services }: Container) {
  const { orders, messages, content } = services;
  const actorOf = (auth: RequestAuth) => ({ id: auth.user.id, role: auth.user.role });

  return {
    async create(req: Request, res: Response) {
      const body = req.body as Record<string, unknown> | undefined;
      const result = await orders.create({
        user: req.auth?.user ?? null,
        rawData: body?.data,
        files: incomingFiles(req),
      });
      const locale = displayLocale(req, req.auth);
      const { tracking } = result;
      const dto: CreateOrderResultDto = {
        order: toOrderDetailDto(result.order, locale, 'CUSTOMER', 0, { viaTracking: tracking !== null }),
        created: result.created,
        tracking: tracking ? { url: tracking.url, expiresAt: toIso(tracking.expiresAt), emailSent: tracking.emailSent } : null,
      };
      res.status(result.created ? 201 : 200).json(dto);
    },

    async list(req: Request, res: Response) {
      const auth = getAuth(req);
      const { page, pageSize } = parseQuery(listQuery, req);
      const { items, total, unread } = await orders.listForCustomer(auth.user.id, page, pageSize);
      const locale = displayLocale(req, auth);
      res.json(
        paginate(
          items.map((order) => toOrderSummaryDto(order, locale, unread.get(order.id) ?? 0)),
          total,
          page,
          pageSize,
        ),
      );
    },

    async detail(req: Request, res: Response) {
      const auth = getAuth(req);
      const { order, unreadMessages } = await orders.getForViewer(parseIdParam(req), actorOf(auth));
      res.json(toOrderDetailDto(order, displayLocale(req, auth), 'CUSTOMER', unreadMessages));
    },

    async changeStatus(req: Request, res: Response) {
      const auth = getAuth(req);
      const { status } = parseBody(customerStatusActionSchema, req);
      const order = await orders.changeStatus({ orderId: parseIdParam(req), actor: actorOf(auth), status });
      res.json(toOrderDetailDto(order, displayLocale(req, auth), 'CUSTOMER', 0));
    },

    async listMessages(req: Request, res: Response) {
      const auth = getAuth(req);
      const [thread, settings] = await Promise.all([messages.list(parseIdParam(req), actorOf(auth)), content.requireSettings()]);
      const names = { businessName: settings.businessName, contactName: thread.order.contactName };
      res.json(thread.messages.map((m) => toMessageDto(m, auth.user.id, names)));
    },

    async sendMessage(req: Request, res: Response) {
      const auth = getAuth(req);
      const { body } = parseBody(messageBodySchema, req);
      const [{ order, message }, settings] = await Promise.all([
        messages.send(parseIdParam(req), actorOf(auth), body),
        content.requireSettings(),
      ]);
      res.status(201).json(toMessageDto(message, auth.user.id, { businessName: settings.businessName, contactName: order.contactName }));
    },

    async markMessagesRead(req: Request, res: Response) {
      const auth = getAuth(req);
      await messages.markRead(parseIdParam(req), actorOf(auth));
      res.status(204).end();
    },
  };
}

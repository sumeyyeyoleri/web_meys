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
import { setSessionCookie } from '../cookies';
import { paginate } from '../mappers/common';
import { toMessageDto } from '../mappers/message.mapper';
import { toOrderDetailDto, toOrderSummaryDto } from '../mappers/order.mapper';
import { toUserDto } from '../mappers/user.mapper';
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

export function createOrderController({ services, config }: Container) {
  const { orders, messages, sessions, content } = services;
  const actorOf = (auth: RequestAuth) => ({ id: auth.user.id, role: auth.user.role });

  return {
    async create(req: Request, res: Response) {
      const body = req.body as Record<string, unknown> | undefined;
      const result = await orders.create({
        user: req.auth?.user ?? null,
        rawData: body?.data,
        files: incomingFiles(req),
      });
      if (result.accountCreated) {
        const { token, expiresAt } = await sessions.create(result.user.id);
        setSessionCookie(res, config, token, expiresAt);
      }
      const locale = displayLocale(req, req.auth);
      const dto: CreateOrderResultDto = {
        order: toOrderDetailDto(result.order, locale, 'CUSTOMER', 0),
        created: result.created,
        user: toUserDto(result.user),
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
      const [items, settings] = await Promise.all([
        messages.list(parseIdParam(req), actorOf(auth)),
        content.requireSettings(),
      ]);
      res.json(items.map((m) => toMessageDto(m, auth.user.id, settings.businessName)));
    },

    async sendMessage(req: Request, res: Response) {
      const auth = getAuth(req);
      const { body } = parseBody(messageBodySchema, req);
      const [message, settings] = await Promise.all([
        messages.send(parseIdParam(req), actorOf(auth), body),
        content.requireSettings(),
      ]);
      res.status(201).json(toMessageDto(message, auth.user.id, settings.businessName));
    },

    async markMessagesRead(req: Request, res: Response) {
      const auth = getAuth(req);
      await messages.markRead(parseIdParam(req), actorOf(auth));
      res.status(204).end();
    },
  };
}

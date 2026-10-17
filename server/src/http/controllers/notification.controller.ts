import type { Request, Response } from 'express';
import { paginationQuerySchema, type UnreadCountDto } from '@painter/shared';
import type { Services } from '../../container';
import { paginate } from '../mappers/common';
import { toNotificationDto } from '../mappers/notification.mapper';
import { getAuth } from '../middleware/auth';
import { parseIdParam, parseQuery } from '../middleware/validation';

export function createNotificationController({ notifications }: Services) {
  return {
    async list(req: Request, res: Response) {
      const { user } = getAuth(req);
      const { page, pageSize } = parseQuery(paginationQuerySchema, req);
      const { items, total } = await notifications.list(user.id, page, pageSize);
      res.json(paginate(items.map(toNotificationDto), total, page, pageSize));
    },

    async unreadCount(req: Request, res: Response) {
      const { user } = getAuth(req);
      const body: UnreadCountDto = { count: await notifications.unreadCount(user.id) };
      res.json(body);
    },

    async markRead(req: Request, res: Response) {
      const { user } = getAuth(req);
      await notifications.markRead(user.id, parseIdParam(req));
      res.status(204).end();
    },

    async markAllRead(req: Request, res: Response) {
      const { user } = getAuth(req);
      await notifications.markAllRead(user.id);
      res.status(204).end();
    },
  };
}

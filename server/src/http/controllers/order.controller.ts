import type { Request, Response } from 'express';
import { isLocale, type CreateOrderResultDto, type Locale } from '@painter/shared';
import type { Container } from '../../container';
import { toIso } from '../mappers/common';
import { toOrderDetailDto } from '../mappers/order.mapper';
import { incomingFiles } from '../middleware/upload';

/** Display language for service names: `?locale=` (the site language), else nl-BE. */
function displayLocale(req: Request): Locale {
  return isLocale(req.query.locale) ? req.query.locale : 'nl-BE';
}

export function createOrderController({ services }: Container) {
  const { orders } = services;

  return {
    /** Anyone can order; the response carries the private tracking link (shown once). */
    async create(req: Request, res: Response) {
      const body = req.body as Record<string, unknown> | undefined;
      const result = await orders.create({ rawData: body?.data, files: incomingFiles(req) });
      const { tracking } = result;
      const dto: CreateOrderResultDto = {
        order: toOrderDetailDto(result.order, displayLocale(req), 'CUSTOMER', 0, { viaTracking: true }),
        created: result.created,
        tracking: { url: tracking.url, expiresAt: toIso(tracking.expiresAt), emailSent: tracking.emailSent },
      };
      res.status(result.created ? 201 : 200).json(dto);
    },
  };
}

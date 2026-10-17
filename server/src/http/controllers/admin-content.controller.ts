import type { Request, Response } from 'express';
import {
  contentUpdateSchema,
  portfolioItemSchema,
  reorderSchema,
  serviceSchema,
  siteSettingsSchema,
  toggleSchema,
  type AdminContentDto,
  type MediaUploadDto,
} from '@painter/shared';
import type { Services } from '../../container';
import { toAdminPortfolioItemDto, toAdminServiceDto, toAdminSettingsDto } from '../mappers/admin.mapper';
import { incomingFile } from '../middleware/media-upload';
import { parseBody, parseIdParam } from '../middleware/validation';

export function createAdminContentController({ adminContent }: Services) {
  return {
    /* Portfolio */
    async listPortfolio(_req: Request, res: Response) {
      res.json((await adminContent.listPortfolio()).map(toAdminPortfolioItemDto));
    },
    async createPortfolio(req: Request, res: Response) {
      const item = await adminContent.createPortfolio(parseBody(portfolioItemSchema, req));
      res.status(201).json(toAdminPortfolioItemDto(item));
    },
    async updatePortfolio(req: Request, res: Response) {
      const id = parseIdParam(req);
      res.json(toAdminPortfolioItemDto(await adminContent.updatePortfolio(id, parseBody(portfolioItemSchema, req))));
    },
    async setPortfolioFeatured(req: Request, res: Response) {
      const id = parseIdParam(req);
      const { value } = parseBody(toggleSchema, req);
      res.json(toAdminPortfolioItemDto(await adminContent.setPortfolioFeatured(id, value)));
    },
    async deletePortfolio(req: Request, res: Response) {
      await adminContent.deletePortfolio(parseIdParam(req));
      res.status(204).end();
    },
    async reorderPortfolio(req: Request, res: Response) {
      const { id, direction } = parseBody(reorderSchema, req);
      res.json((await adminContent.movePortfolio(id, direction)).map(toAdminPortfolioItemDto));
    },

    /* Services */
    async listServices(_req: Request, res: Response) {
      res.json((await adminContent.listServices()).map(toAdminServiceDto));
    },
    async createService(req: Request, res: Response) {
      res.status(201).json(toAdminServiceDto(await adminContent.createService(parseBody(serviceSchema, req))));
    },
    async updateService(req: Request, res: Response) {
      const id = parseIdParam(req);
      res.json(toAdminServiceDto(await adminContent.updateService(id, parseBody(serviceSchema, req))));
    },
    async setServiceActive(req: Request, res: Response) {
      const id = parseIdParam(req);
      const { value } = parseBody(toggleSchema, req);
      res.json(toAdminServiceDto(await adminContent.setServiceActive(id, value)));
    },
    async deleteService(req: Request, res: Response) {
      await adminContent.deleteService(parseIdParam(req));
      res.status(204).end();
    },
    async reorderServices(req: Request, res: Response) {
      const { id, direction } = parseBody(reorderSchema, req);
      res.json((await adminContent.moveService(id, direction)).map(toAdminServiceDto));
    },

    /* Text blocks */
    async listContent(_req: Request, res: Response) {
      const body: AdminContentDto = { items: await adminContent.listContent() };
      res.json(body);
    },
    async updateContent(req: Request, res: Response) {
      const body: AdminContentDto = { items: await adminContent.updateContent(parseBody(contentUpdateSchema, req)) };
      res.json(body);
    },

    /* Settings */
    async getSettings(_req: Request, res: Response) {
      const { settings, smtpConfigured } = await adminContent.getSettings();
      res.json(toAdminSettingsDto(settings, smtpConfigured));
    },
    async updateSettings(req: Request, res: Response) {
      const { settings, smtpConfigured } = await adminContent.updateSettings(parseBody(siteSettingsSchema, req));
      res.json(toAdminSettingsDto(settings, smtpConfigured));
    },

    /* Media */
    async uploadMedia(req: Request, res: Response) {
      const body: MediaUploadDto = { url: await adminContent.uploadImage(incomingFile(req)) };
      res.status(201).json(body);
    },
  };
}

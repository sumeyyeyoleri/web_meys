import type { Request, Response } from 'express';
import { z } from 'zod';
import { localeSchema, PORTFOLIO_CATEGORIES, queryBooleanSchema, spaceSchema, type SiteDto } from '@painter/shared';
import type { Services } from '../../container';
import { toPortfolioItemDto, toPublicSettingsDto, toServiceDto } from '../mappers/content.mapper';
import { parseIdParam, parseQuery } from '../middleware/validation';

const localeQuery = z.object({ locale: localeSchema.optional() });
const portfolioQuery = localeQuery.extend({
  category: z.enum(PORTFOLIO_CATEGORIES, { error: 'validation.invalidOption' }).optional(),
  space: spaceSchema.optional(),
  featured: queryBooleanSchema.optional(),
});

export function createPublicController({ content }: Services) {
  return {
    async site(req: Request, res: Response) {
      const { locale: requested } = parseQuery(localeQuery, req);
      const locale = await content.resolveLocale(requested);
      const [settings, texts] = await Promise.all([content.requireSettings(), content.getContent(locale)]);
      const body: SiteDto = { locale, settings: toPublicSettingsDto(settings), content: texts };
      res.json(body);
    },

    async services(req: Request, res: Response) {
      const locale = await content.resolveLocale(parseQuery(localeQuery, req).locale);
      const services = await content.listActiveServices();
      res.json(services.map((service) => toServiceDto(service, locale)));
    },

    async portfolio(req: Request, res: Response) {
      const query = parseQuery(portfolioQuery, req);
      const locale = await content.resolveLocale(query.locale);
      const items = await content.listPortfolio({ category: query.category, space: query.space, featured: query.featured });
      res.json(items.map((item) => toPortfolioItemDto(item, locale)));
    },

    async portfolioItem(req: Request, res: Response) {
      const locale = await content.resolveLocale(parseQuery(localeQuery, req).locale);
      const item = await content.getPublishedPortfolioItem(parseIdParam(req));
      res.json(toPortfolioItemDto(item, locale));
    },
  };
}

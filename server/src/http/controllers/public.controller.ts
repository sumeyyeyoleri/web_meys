import type { Request, Response } from 'express';
import { z } from 'zod';
import { localeSchema, queryBooleanSchema, type SiteDto } from '@painter/shared';
import type { Services } from '../../container';
import { toCategoryDto, toPortfolioItemDto, toPublicSettingsDto } from '../mappers/content.mapper';
import { parseIdParam, parseQuery } from '../middleware/validation';

const localeQuery = z.object({ locale: localeSchema.optional() });
const portfolioQuery = localeQuery.extend({
  /** Category slug; an unknown or hidden one simply matches no works. */
  category: z.string().trim().max(100, 'validation.tooLong').optional(),
  featured: queryBooleanSchema.optional(),
});

export function createPublicController({ content, email, translation }: Services) {
  return {
    async site(req: Request, res: Response) {
      const { locale: requested } = parseQuery(localeQuery, req);
      const locale = await content.resolveLocale(requested);
      const [settings, texts] = await Promise.all([content.requireSettings(), content.getContent(locale)]);
      const body: SiteDto = { locale, settings: toPublicSettingsDto(settings, { emailAvailable: email.isConfigured, translationAvailable: translation.available }), content: texts };
      res.json(body);
    },

    async portfolio(req: Request, res: Response) {
      const query = parseQuery(portfolioQuery, req);
      const locale = await content.resolveLocale(query.locale);
      const items = await content.listPortfolio({ category: query.category || undefined, featured: query.featured });
      res.json(items.map((item) => toPortfolioItemDto(item, locale)));
    },

    async categories(req: Request, res: Response) {
      const locale = await content.resolveLocale(parseQuery(localeQuery, req).locale);
      const categories = await content.listCategories();
      res.json(categories.map((category) => toCategoryDto(category, locale)));
    },

    async portfolioItem(req: Request, res: Response) {
      const locale = await content.resolveLocale(parseQuery(localeQuery, req).locale);
      const item = await content.getPublishedPortfolioItem(parseIdParam(req));
      res.json(toPortfolioItemDto(item, locale));
    },
  };
}

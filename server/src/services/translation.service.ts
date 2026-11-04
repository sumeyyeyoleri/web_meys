import { localeFromDb, localeToDb, type Locale } from '@painter/shared';
import { AppError, notFound } from '../domain/errors';
import { TranslatorError, type Translator } from '../infrastructure/translator';
import type { Repositories } from '../repositories';
import type { Actor, OrderService } from './order.service';

interface Deps {
  repos: Repositories;
  orders: OrderService;
  translator: Translator;
}

/** DeepL answers 456 when the monthly character quota is used up. */
const QUOTA_EXCEEDED = 456;

/**
 * Message translation on request ("Translate" button, never automatic). Each message is
 * translated at most once per language: the result is stored and reused.
 */
export function createTranslationService({ repos, orders, translator }: Deps) {
  return {
    get available() {
      return translator.configured;
    },

    async translateMessage(orderId: string, viewer: Actor, messageId: string, target: Locale) {
      if (!translator.configured) throw new AppError(503, 'TRANSLATION_UNAVAILABLE', 'Translation is not configured');
      const order = await orders.loadOrder(orderId, viewer);
      const message = await repos.messages.findInOrder(order.id, messageId);
      if (!message) throw notFound('Message not found');

      const targetLocale = localeToDb(target);
      const result = (body: string) => ({ messageId: message.id, locale: target, body });
      // Already in that language: nothing to translate (and nothing to pay for).
      if (message.locale === targetLocale) return result(message.body);
      const cached = await repos.messageTranslations.find(message.id, targetLocale);
      if (cached) return result(cached.body);

      let translated: string;
      try {
        translated = await translator.translate(message.body, localeFromDb(targetLocale));
      } catch (error) {
        if (error instanceof TranslatorError && error.status === QUOTA_EXCEEDED) {
          throw new AppError(503, 'TRANSLATION_LIMIT_REACHED', 'Translation quota exceeded');
        }
        throw new AppError(502, 'TRANSLATION_FAILED', 'Translation failed');
      }
      const saved = await repos.messageTranslations.save(message.id, targetLocale, translated);
      return result(saved.body);
    },
  };
}

export type TranslationService = ReturnType<typeof createTranslationService>;

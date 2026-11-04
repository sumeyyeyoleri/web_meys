import type { Locale as DbLocale } from '@prisma/client';
import type { Db } from './db';

export function createMessageTranslationRepository(db: Db) {
  return {
    find(messageId: string, targetLocale: DbLocale) {
      return db.messageTranslation.findUnique({ where: { messageId_targetLocale: { messageId, targetLocale } } });
    },

    /** Upsert: two simultaneous clicks store one translation. */
    save(messageId: string, targetLocale: DbLocale, body: string) {
      return db.messageTranslation.upsert({
        where: { messageId_targetLocale: { messageId, targetLocale } },
        update: {},
        create: { messageId, targetLocale, body },
      });
    },
  };
}

import { LOCALES, localeFromDb, type Locale, type SetupChecklistDto } from '@painter/shared';
import type { LocalizedContent, SiteSettings } from '@prisma/client';
import { SEED_CONTENT, SEED_SETTINGS } from '../../prisma/seed-data/content';

interface SetupState {
  settings: Pick<SiteSettings, 'logoUrl' | 'contactEmail' | 'contactPhone' | 'contactAddress'>;
  content: Pick<LocalizedContent, 'key' | 'locale' | 'value'>[];
  ownWorks: number;
  publishedSamples: number;
}

/**
 * "Personalise your site" (PROMPT.md §18.3), worked out from the real data: an item is done once
 * the placeholder from the seed is gone, so it never has to be ticked off by hand.
 */
export function setupChecklist({ settings, content, ownWorks, publishedSamples }: SetupState): SetupChecklistDto {
  const about = (locale: Locale) =>
    content.find((row) => row.key === 'about.body' && localeFromDb(row.locale) === locale)?.value.trim() ?? '';
  // Empty languages show the Dutch text, so the Dutch text must be the artist's own and no language may still show the sample text.
  const aboutText = about('nl-BE') !== '' && LOCALES.every((locale) => about(locale) !== SEED_CONTENT['about.body'][locale]);

  const placeholders = [SEED_SETTINGS.contactEmail, SEED_SETTINGS.contactPhone, SEED_SETTINGS.contactAddress];
  const contact = [settings.contactEmail, settings.contactPhone, settings.contactAddress];
  const contactDetails = Boolean(settings.contactEmail || settings.contactPhone) && contact.every((value) => !value || !placeholders.includes(value));

  return {
    logo: settings.logoUrl !== null,
    firstWork: ownWorks > 0,
    aboutText,
    samplesHidden: publishedSamples === 0,
    contactDetails,
  };
}

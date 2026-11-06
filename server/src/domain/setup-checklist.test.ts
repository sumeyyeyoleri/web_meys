import { describe, expect, it } from 'vitest';
import { SEED_CONTENT, SEED_SETTINGS } from '../../prisma/seed-data/content';
import { setupChecklist } from './setup-checklist';

const noContact = { logoUrl: null, contactEmail: null, contactPhone: null, contactAddress: null };
const about = (values: Partial<Record<'NL_BE' | 'EN' | 'TR', string>>) =>
  Object.entries(values).map(([locale, value]) => ({ key: 'about.body', locale: locale as 'NL_BE', value }));
const check = (state: Partial<Parameters<typeof setupChecklist>[0]>) =>
  setupChecklist({ settings: noContact, content: [], ownWorks: 0, publishedSamples: 0, ...state });

describe('setup checklist', () => {
  it('keeps the about text open while any language still shows the sample text', () => {
    const seeded = about({ NL_BE: SEED_CONTENT['about.body']['nl-BE'], EN: SEED_CONTENT['about.body'].en, TR: SEED_CONTENT['about.body'].tr });
    expect(check({ content: seeded }).aboutText).toBe(false);
    // Dutch rewritten, English still the sample.
    expect(check({ content: about({ NL_BE: 'Mijn verhaal.', EN: SEED_CONTENT['about.body'].en }) }).aboutText).toBe(false);
    // Empty languages fall back to the (own) Dutch text.
    expect(check({ content: about({ NL_BE: 'Mijn verhaal.', EN: '' }) }).aboutText).toBe(true);
    expect(check({ content: about({ EN: 'My story.' }) }).aboutText).toBe(false);
  });

  it('counts contact details as done only without the placeholders', () => {
    const seeded = { ...noContact, contactEmail: SEED_SETTINGS.contactEmail, contactPhone: SEED_SETTINGS.contactPhone, contactAddress: SEED_SETTINGS.contactAddress };
    expect(check({ settings: seeded }).contactDetails).toBe(false);
    expect(check({ settings: { ...seeded, contactEmail: 'hallo@atelier.be' } }).contactDetails).toBe(false);
    expect(check({ settings: { ...noContact, contactPhone: '+32 470 12 34 56' } }).contactDetails).toBe(true);
    expect(check({ settings: { ...noContact, contactAddress: 'Kerkstraat 2, Gent' } }).contactDetails).toBe(false);
  });
});

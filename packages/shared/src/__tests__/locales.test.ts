import { describe, expect, it } from 'vitest';
import { DB_LOCALES, isLocale, localeFromDb, localeToDb, LOCALES } from '../locales';

describe('locale mapping', () => {
  it('round-trips every locale through the database enum', () => {
    for (const locale of LOCALES) {
      expect(localeFromDb(localeToDb(locale))).toBe(locale);
    }
    expect(LOCALES.map(localeToDb)).toEqual([...DB_LOCALES]);
  });

  it('recognises only supported locales', () => {
    expect(isLocale('nl-BE')).toBe(true);
    expect(isLocale('nl')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

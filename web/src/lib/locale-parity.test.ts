import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@painter/shared';

/** Every namespace has exactly the same keys in nl-BE, en and tr (PROMPT.md §4). */
const dir = path.resolve(__dirname, '../locales');

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

const read = (locale: string, file: string) => JSON.parse(readFileSync(path.join(dir, locale, file), 'utf8')) as unknown;

describe('locale key parity', () => {
  const files = readdirSync(path.join(dir, 'nl-BE')).filter((f) => f.endsWith('.json'));

  it.each(files)('%s has the same keys in every language', (file) => {
    const reference = keys(read('nl-BE', file)).sort();
    for (const locale of LOCALES) {
      expect(keys(read(locale, file)).sort(), `${locale}/${file}`).toEqual(reference);
    }
  });

  it('has no empty translations', () => {
    for (const locale of LOCALES) {
      for (const file of files) {
        const flat = JSON.stringify(read(locale, file));
        expect(flat, `${locale}/${file}`).not.toContain('""');
      }
    }
  });
});

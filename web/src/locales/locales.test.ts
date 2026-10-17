import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, LOCALES, ORDER_STATUSES, PORTFOLIO_CATEGORIES, SPACES } from '@painter/shared';
import { NAMESPACES, resources } from '../lib/i18n';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

const flat = (locale: (typeof LOCALES)[number], ns: (typeof NAMESPACES)[number]) =>
  flatten(resources[locale][ns] as unknown as Tree);

/** Plural suffixes may legitimately differ between languages. */
const basePluralKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

describe('locale files', () => {
  for (const ns of NAMESPACES) {
    it(`"${ns}" has the same keys in every language`, () => {
      const reference = new Set([...flat('nl-BE', ns).keys()].map(basePluralKey));
      for (const locale of LOCALES) {
        const keys = new Set([...flat(locale, ns).keys()].map(basePluralKey));
        const missing = [...reference].filter((k) => !keys.has(k));
        const extra = [...keys].filter((k) => !reference.has(k));
        expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
      }
    });

    it(`"${ns}" has no empty translations`, () => {
      for (const locale of LOCALES) {
        const empty = [...flat(locale, ns)].filter(([, v]) => v.trim() === '').map(([k]) => k);
        expect({ locale, empty }).toEqual({ locale, empty: [] });
      }
    });
  }

  it('translates every validation key used by the shared schemas and the server', () => {
    const root = path.resolve(__dirname, '../../..');
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) sources.push(full);
      }
    };
    walk(path.join(root, 'packages/shared/src'));
    walk(path.join(root, 'server/src'));
    walk(path.join(root, 'web/src'));

    const used = new Set<string>();
    for (const file of sources) {
      for (const match of readFileSync(file, 'utf8').matchAll(/['"`]validation\.([a-zA-Z]+)['"`]/g)) used.add(match[1]!);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const locale of LOCALES) {
      const keys = flat(locale, 'validation');
      const missing = [...used].filter((k) => !keys.has(k));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  it('labels every error code, status, category and space', () => {
    for (const locale of LOCALES) {
      const keys = flat(locale, 'common');
      const required = [
        ...ERROR_CODES.map((c) => `errors.${c}`),
        'errors.NETWORK_ERROR',
        ...ORDER_STATUSES.map((s) => `status.${s}`),
        ...PORTFOLIO_CATEGORIES.map((c) => `category.${c}`),
        ...SPACES.map((s) => `space.${s}`),
        ...LOCALES.map((l) => `language.${l}`),
      ];
      expect({ locale, missing: required.filter((k) => !keys.has(k)) }).toEqual({ locale, missing: [] });
    }
  });
});

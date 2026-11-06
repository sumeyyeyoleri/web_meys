import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_KEYS, LOCALES, type AdminContentDto } from '@painter/shared';
import { setLocale } from '../../../lib/i18n';
import { adminUser, json, mockApi } from '../../../test/fixtures';
import { renderApp } from '../../../test/render';

const user = userEvent.setup();
const languages = () => within(screen.getByRole('group', { name: 'Düzenlenen dil' }));
beforeEach(() => setLocale('tr'));
afterEach(() => vi.unstubAllGlobals());

const content: AdminContentDto = {
  items: CONTENT_KEYS.flatMap((key) =>
    LOCALES.map((locale) => ({ key, locale, value: key === 'hero.title' ? { 'nl-BE': 'Kunst op maat', en: 'Custom art', tr: '' }[locale] : `${key} ${locale}` })),
  ),
};

function textsApi(put?: (body: unknown) => void) {
  return mockApi({
    user: { ...adminUser, preferredLocale: 'tr' },
    routes: {
      'GET /api/admin/stats': () => json(200, { total: 0, newOrders: 0, inReview: 0, inProgress: 0, completed: 0, unreadCustomerMessages: 0, recentOrders: [], recentMessages: [] }),
      'GET /api/admin/content': () => json(200, content),
      'PUT /api/admin/content': (init) => {
        const body = JSON.parse(String(init?.body)) as { items: AdminContentDto['items'] };
        put?.(body);
        const items = content.items.map((item) => body.items.find((c) => c.key === item.key && c.locale === item.locale) ?? item);
        return json(200, { items });
      },
    },
  });
}

describe('page texts', () => {
  it('opens in the dashboard language and shows where an empty text falls back to Dutch', async () => {
    textsApi();
    renderApp('/admin/texts');
    const title = (await screen.findByLabelText('Başlık')) as HTMLTextAreaElement;
    expect(languages().getByRole('button', { name: 'Türkçe' }).getAttribute('aria-pressed')).toBe('true');
    expect(title.value).toBe('');
    expect(title.placeholder).toBe('Kunst op maat');
    expect(screen.getByText('Boş; sitede Felemenkçe metin gösteriliyor.')).toBeTruthy();
  });

  it('saves only the changed texts, across languages', async () => {
    let sent: unknown;
    textsApi((body) => (sent = body));
    renderApp('/admin/texts');
    await user.type(await screen.findByLabelText('Başlık'), 'Size özel sanat');
    await user.click(languages().getByRole('button', { name: 'English' }));
    const about = screen.getByLabelText('Hakkımda başlığı') as HTMLInputElement;
    expect(about.value).toBe('about.title en');
    await user.clear(about);
    await user.type(about, 'About me');
    // The edit in Turkish is kept while switching languages.
    expect(within(languages().getByRole('button', { name: /Türkçe/ })).getByText(/kaydedilmemiş/)).toBeTruthy();
    expect(screen.getByText('2 kaydedilmemiş değişiklik')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Metinleri kaydet' }));
    expect(await screen.findByText('Metinler kaydedildi.')).toBeTruthy();
    expect(sent).toEqual({
      items: [
        { key: 'hero.title', locale: 'tr', value: 'Size özel sanat' },
        { key: 'about.title', locale: 'en', value: 'About me' },
      ],
    });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Metinleri kaydet' }) as HTMLButtonElement).disabled).toBe(true));
  });
});

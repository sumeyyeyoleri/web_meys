import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSettingsDto } from '@painter/shared';
import { setLocale } from '../../../lib/i18n';
import { adminUser, json, mockApi, site } from '../../../test/fixtures';
import { renderApp } from '../../../test/render';

const user = userEvent.setup();
beforeEach(() => setLocale('tr'));
afterEach(() => vi.unstubAllGlobals());

const settings: AdminSettingsDto = { ...site.settings, emailNotificationsEnabled: true, smtpConfigured: false };

function settingsApi(routes: NonNullable<NonNullable<Parameters<typeof mockApi>[0]>['routes']> = {}) {
  return mockApi({
    user: { ...adminUser, preferredLocale: 'tr' },
    routes: {
      'GET /api/admin/stats': () => json(200, { total: 0, newOrders: 0, inReview: 0, inProgress: 0, completed: 0, unreadCustomerMessages: 0, recentOrders: [], recentMessages: [] }),
      'GET /api/admin/settings': () => json(200, settings),
      ...routes,
    },
  });
}

const field = (name: RegExp | string) => screen.getByLabelText(name, { selector: 'input,textarea' }) as HTMLInputElement;

describe('settings', () => {
  it('saves contact details, Instagram and the accent colour', async () => {
    let sent: Record<string, unknown> = {};
    settingsApi({ 'PUT /api/admin/settings': (init) => ((sent = JSON.parse(String(init?.body))), json(200, { ...settings, ...sent })) });
    renderApp('/admin/settings');
    await screen.findByLabelText(/^Telefon/, { selector: 'input' });
    expect(field(/^Telefon/).value).toBe('+32 470 00 00 00');
    // Nothing to save yet.
    expect((screen.getByRole('button', { name: 'Ayarları kaydet' }) as HTMLButtonElement).disabled).toBe(true);

    await user.clear(field(/^Telefon/));
    await user.type(field(/^Telefon/), '+32 486 11 22 33');
    await user.clear(field(/Instagram linki/));
    await user.type(field(/Instagram linki/), 'https://www.instagram.com/meysart__');
    await user.clear(field(/Renk kodu/));
    await user.type(field(/Renk kodu/), '#E8D3A8');
    await user.click(screen.getByRole('button', { name: 'Ayarları kaydet' }));

    expect(await screen.findByText('Ayarlar kaydedildi.')).toBeTruthy();
    expect(sent).toMatchObject({
      contactPhone: '+32 486 11 22 33',
      instagramUrl: 'https://www.instagram.com/meysart__',
      accentColor: '#E8D3A8',
      enabledLocales: ['nl-BE', 'en', 'tr'],
    });
  });

  it('checks the Instagram link and the colour code before saving', async () => {
    const fetchMock = settingsApi();
    renderApp('/admin/settings');
    await screen.findByLabelText(/Instagram linki/, { selector: 'input' });
    await user.clear(field(/Instagram linki/));
    await user.type(field(/Instagram linki/), 'instagram meysart');
    await user.clear(field(/Renk kodu/));
    await user.type(field(/Renk kodu/), 'beige');
    await user.click(screen.getByRole('button', { name: 'Ayarları kaydet' }));
    await waitFor(() => expect(field(/Instagram linki/).getAttribute('aria-invalid')).toBe('true'));
    expect(field(/Renk kodu/).getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('keeps Dutch always on and says when email sending is not set up', async () => {
    settingsApi();
    renderApp('/admin/settings');
    const languages = await screen.findByRole('region', { name: 'Diller' });
    const dutch = within(languages).getByRole('checkbox', { name: /Nederlands/ }) as HTMLInputElement;
    expect(dutch.checked).toBe(true);
    expect(dutch.disabled).toBe(true);
    expect(screen.getByText(/E-posta gönderimi henüz ayarlı değil/)).toBeTruthy();
  });

  it('uploads a logo right away', async () => {
    let uploaded: File | null = null;
    settingsApi({
      'POST /api/admin/settings/logo': (init) => {
        uploaded = (init?.body as FormData).get('file') as File;
        return json(200, { ...settings, logoUrl: '/media/uploads/logo/x.svg' });
      },
    });
    renderApp('/admin/settings');
    const logo = await screen.findByRole('region', { name: 'Logo' });
    const input = within(logo).getByLabelText('Logo yükle') as HTMLInputElement;
    await user.upload(input, new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(await screen.findByText('Logo kaydedildi.')).toBeTruthy();
    expect(uploaded!.name).toBe('logo.svg');
    expect(await within(logo).findByRole('img', { name: 'Şu anki logo' })).toBeTruthy();
  });

  it('is in the dashboard menu', async () => {
    settingsApi();
    renderApp('/admin');
    const menu = (await screen.findAllByRole('navigation', { name: 'Panel menüsü' }))[0]!;
    expect(within(menu).getByRole('link', { name: 'Ayarlar' }).getAttribute('href')).toBe('/admin/settings');
  });
});

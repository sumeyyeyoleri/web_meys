import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminServiceDto } from '@painter/shared';
import { setLocale } from '../../../lib/i18n';
import { adminUser, json, mockApi } from '../../../test/fixtures';
import { renderApp } from '../../../test/render';

const user = userEvent.setup();
beforeEach(() => setLocale('tr'));
afterEach(() => vi.unstubAllGlobals());

const names = (tr: string, en = `${tr} EN`, nl = `${tr} NL`) => ({
  'nl-BE': { name: nl, description: null },
  en: { name: en, description: null },
  tr: { name: tr, description: null },
});
const mural: AdminServiceDto = { id: 'srv1', imageUrl: null, isActive: true, isWallService: true, defaultUnit: 'M', sortOrder: 0, orderCount: 2, translations: names('Duvar resmi') };
const canvas: AdminServiceDto = { id: 'srv2', imageUrl: null, isActive: true, isWallService: false, defaultUnit: 'CM', sortOrder: 1, orderCount: 0, translations: names('Tuval ve portre') };

type Routes = NonNullable<NonNullable<Parameters<typeof mockApi>[0]>['routes']>;
function servicesApi(routes: Routes = {}) {
  return mockApi({
    user: { ...adminUser, preferredLocale: 'tr' },
    routes: {
      'GET /api/admin/stats': () => json(200, { total: 0, newOrders: 0, inReview: 0, inProgress: 0, completed: 0, unreadCustomerMessages: 0, recentOrders: [], recentMessages: [] }),
      'GET /api/admin/services': () => json(200, [mural, canvas]),
      ...routes,
    },
  });
}

describe('services', () => {
  it('lists the services with their unit, and adds one with all three names', async () => {
    let sent: Record<string, unknown> = {};
    servicesApi({ 'POST /api/admin/services': (init) => ((sent = JSON.parse(String(init?.body))), json(201, { ...canvas, id: 'srv3' })) });
    renderApp('/admin/services');
    expect(await screen.findByText('Duvar resmi')).toBeTruthy();
    expect(screen.getByText('Birim: m')).toBeTruthy();
    expect(screen.getByText('2 sipariş')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Hizmet ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Yeni hizmet' });
    await user.click(within(dialog).getByRole('button', { name: 'Hizmeti kaydet' }));
    // Every language needs a name.
    await waitFor(() => expect(within(dialog).getAllByText('Bu alan zorunludur.')).toHaveLength(3));

    const groups = within(dialog).getAllByRole('group');
    for (const [index, name] of ['Rolluiken', 'Shutters', 'Kepenk ve vitrin'].entries()) {
      await user.type(within(groups[index]!).getByLabelText(/^Ad/), name);
    }
    await user.selectOptions(within(dialog).getByLabelText(/Varsayılan ölçü birimi/), 'M');
    await user.click(within(dialog).getByRole('button', { name: 'Hizmeti kaydet' }));
    expect(await screen.findByText('Hizmet kaydedildi.')).toBeTruthy();
    expect(sent).toMatchObject({
      isActive: true,
      defaultUnit: 'M',
      translations: { 'nl-BE': { name: 'Rolluiken' }, en: { name: 'Shutters' }, tr: { name: 'Kepenk ve vitrin' } },
    });
  });

  it('moves a service and switches it off', async () => {
    const calls: string[] = [];
    servicesApi({
      'POST /api/admin/services/reorder': (init) => (calls.push(`move ${String(init?.body)}`), json(200, [canvas, mural])),
      'POST /api/admin/services/srv2/active': (init) => (calls.push(`active ${String(init?.body)}`), json(200, { ...canvas, isActive: false })),
    });
    renderApp('/admin/services');
    await screen.findByText('Tuval ve portre');
    expect((screen.getByRole('button', { name: 'Yukarı taşı: Duvar resmi' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Yukarı taşı: Tuval ve portre' }));
    await user.click(screen.getByRole('button', { name: 'Pasif yap: Tuval ve portre' }));
    expect(await screen.findByText(/Hizmet pasif/)).toBeTruthy();
    expect(calls).toEqual(['move {"id":"srv2","direction":"up"}', 'active {"value":false}']);
  });

  it('offers to switch off a service that orders use instead of deleting it', async () => {
    let deleted = false;
    let switchedOff = false;
    servicesApi({
      'DELETE /api/admin/services/srv1': () => ((deleted = true), new Response(null, { status: 204 })),
      'POST /api/admin/services/srv1/active': () => ((switchedOff = true), json(200, { ...mural, isActive: false })),
    });
    renderApp('/admin/services');
    await screen.findByText('Duvar resmi');
    await user.click(screen.getByRole('button', { name: 'Sil: Duvar resmi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet silinsin mi?' });
    expect(within(dialog).getByText(/2 siparişte kullanılıyor/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Pasif yap' }));
    await waitFor(() => expect(switchedOff).toBe(true));
    expect(deleted).toBe(false);
  });
});

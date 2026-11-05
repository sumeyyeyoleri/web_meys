import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminOrderDetailDto, AdminOrderSummaryDto, AdminStatsDto, MessageDto, UserDto } from '@painter/shared';
import i18n, { setLocale } from '../../lib/i18n';
import { adminUser, json, mockApi, site } from '../../test/fixtures';
import { renderApp } from '../../test/render';

const artist: UserDto = { ...adminUser, preferredLocale: 'tr' };
const user = userEvent.setup();

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());

const summary: AdminOrderSummaryDto = {
  id: 'o1',
  reference: 'ORD-2026-7K3QXM',
  title: 'Duinen bij zonsondergang',
  status: 'UNDER_REVIEW',
  serviceName: 'Schilderij op maat',
  quoteAmount: null,
  unreadMessages: 2,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  customerName: 'Lotte Peeters',
  customerEmail: null,
  customerPhone: '+32 470 12 34 56',
  archivedAt: null,
};

const stats: AdminStatsDto = {
  totalOrders: 5,
  newOrders: 2,
  inReview: 1,
  inProgress: 1,
  completed: 1,
  unreadCustomerMessages: 2,
  recentOrders: [summary],
  recentMessages: [
    { id: 'm1', orderId: 'o1', orderReference: summary.reference, customerName: 'Lotte Peeters', body: 'Kan het ook in het blauw?', readAt: null, createdAt: '2026-11-02T10:00:00.000Z' },
  ],
};

const detail = {
  ...summary,
  serviceId: null,
  customRequest: null,
  inspiration: null,
  additionalSpecs: null,
  isWallService: false,
  width: 30,
  height: 40,
  unit: 'CM',
  wallWidth: null,
  wallHeight: null,
  surfaceDetails: null,
  extraSpecifications: null,
  description: 'Een klein schilderij van de duinen bij zonsondergang.',
  stylePreferences: null,
  colorPreferences: null,
  themePreferences: null,
  budgetMin: null,
  budgetMax: null,
  deadline: null,
  extraInstructions: null,
  contact: { fullName: 'Lotte Peeters', email: null, phone: '+32 470 12 34 56', communicationLocale: 'nl-BE' },
  projectAddress: { country: 'België', city: 'Gent', postalCode: '9000', street: 'Veldstraat', houseNumber: '1', addressExtra: null },
  quoteSentAt: null,
  attachments: [{ id: 'a1', originalName: 'muur.png', mimeType: 'image/png', sizeBytes: 100, url: '/api/attachments/a1', createdAt: summary.createdAt }],
  statusHistory: [{ id: 'h1', fromStatus: null, toStatus: 'SUBMITTED', changedByRole: 'CUSTOMER', note: null, quoteAmount: null, createdAt: summary.createdAt }],
  allowedTransitions: ['AWAITING_CUSTOMER_INFO', 'QUOTE_SENT', 'CANCELLED'],
  internalNotes: [{ id: 'n1', body: 'Marge is klein.', authorEmail: adminUser.email, createdAt: summary.createdAt }],
  canArchive: false,
} as AdminOrderDetailDto;

const messages: MessageDto[] = [
  { id: 'm1', senderRole: 'CUSTOMER', senderName: 'Lotte Peeters', locale: 'nl-BE', body: 'Kan het ook in het blauw?', readAt: '2026-11-02T11:00:00.000Z', createdAt: '2026-11-02T10:00:00.000Z', isOwn: false },
  { id: 'm2', senderRole: 'ADMIN', senderName: 'Atelier Test', locale: 'tr', body: 'Tabii, mavi de olur.', readAt: null, createdAt: '2026-11-02T12:00:00.000Z', isOwn: true },
];

const page = (items: AdminOrderSummaryDto[]) => ({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });

type Route = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>;

function adminApi(routes: Record<string, Route> = {}) {
  return mockApi({
    user: artist,
    routes: {
      'GET /api/admin/stats': () => json(200, stats),
      'GET /api/admin/orders': () => json(200, page([summary])),
      'GET /api/admin/orders/o1': () => json(200, detail),
      'GET /api/admin/orders/o1/messages': () => json(200, messages),
      'GET /api/admin/services': () => json(200, []),
      'PATCH /api/admin/me': (init) => json(200, { ...artist, preferredLocale: JSON.parse(String(init?.body)).preferredLocale }),
      ...routes,
    },
  });
}

describe('dashboard access', () => {
  it('sends visitors without a session to the admin login', async () => {
    mockApi();
    const { router } = renderApp('/admin/orders');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    expect(router.state.location.search).toBe('?next=%2Fadmin%2Forders');
  });
});

describe('dashboard layout', () => {
  it('has its own layout with a side menu, opens in the artist\'s language (Turkish) and shows the overview', async () => {
    adminApi();
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Genel bakış' })).toBeTruthy();
    expect(i18n.language).toBe('tr');
    const menu = screen.getAllByRole('navigation', { name: 'Panel menüsü' })[0]!;
    expect(within(menu).getByRole('link', { name: /Siparişler/ }).getAttribute('href')).toBe('/admin/orders');
    expect(await within(menu).findByText(/2 okunmamış mesaj/)).toBeTruthy();
    // Not the public site's navigation.
    expect(screen.queryByRole('navigation', { name: /Ana menü|Hoofdnavigatie/ })).toBeNull();
    expect(await screen.findByText("Toplam sipariş")).toBeTruthy();
    expect(screen.getByText('Kan het ook in het blauw?')).toBeTruthy();
  });

  it('opens the menu as a sheet on small screens', async () => {
    adminApi();
    renderApp('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Genel bakış' });
    await user.click(screen.getByRole('button', { name: 'Menüyü aç' }));
    const sheet = await screen.findByRole('dialog', { name: 'Panel menüsü' });
    await user.click(within(sheet).getByRole('link', { name: /Siparişler/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Siparişler' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('saves the language chosen in the top bar for the artist', async () => {
    const fetchMock = adminApi();
    renderApp('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Genel bakış' });
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy();
    const patch = fetchMock.mock.calls.find(([url, init]) => String(url).includes('/api/admin/me') && init?.method === 'PATCH');
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ preferredLocale: 'en' });
  });
});

describe('orders list', () => {
  it('keeps filters in the URL and sends them to the API', async () => {
    const fetchMock = adminApi();
    const { router } = renderApp('/admin/orders');
    expect((await screen.findAllByText('ORD-2026-7K3QXM')).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText('Durum'), 'QUOTE_SENT');
    await waitFor(() => expect(router.state.location.search).toContain('status=QUOTE_SENT'));
    await user.type(screen.getByLabelText('Ara'), 'Lotte');
    await user.click(screen.getByRole('button', { name: 'Ara' }));
    await waitFor(() => expect(router.state.location.search).toContain('q=Lotte'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('/api/admin/orders?') && String(url).includes('status=QUOTE_SENT') && String(url).includes('q=Lotte')),
      ).toBe(true),
    );
  });
});

describe('orders list rows', () => {
  it('has no "Detay" button; the reference is plain text and clicking the row opens the order', async () => {
    adminApi();
    const { router } = renderApp('/admin/orders');
    await screen.findAllByText('ORD-2026-7K3QXM');
    expect(screen.queryByText('Detay')).toBeNull();
    for (const reference of screen.getAllByText('ORD-2026-7K3QXM')) expect(reference.closest('a')).toBeNull();
    await user.click(screen.getAllByText('Lotte Peeters')[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/orders/o1'));
  });

  it('reaches a row with Tab and opens it with Enter', async () => {
    adminApi();
    const { router } = renderApp('/admin/orders');
    const rows = await screen.findAllByLabelText('ORD-2026-7K3QXM siparişini aç');
    // The table row (desktop) and the card (phones) are both focusable.
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.getAttribute('tabindex')).toBe('0');
    // Tab from the last filter control lands on the first row.
    screen.getByRole('checkbox').focus();
    await user.tab();
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/orders/o1'));
  });
});

describe('order detail', () => {
  it('offers WhatsApp and call buttons for the customer phone', async () => {
    adminApi();
    renderApp('/admin/orders/o1');
    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp’tan yaz' });
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/32470123456');
    expect(whatsapp.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Ara' }).getAttribute('href')).toBe('tel:+32470123456');
  });

  it('says "Telefon numarası yok" instead of the buttons when the order has no phone', async () => {
    adminApi({ 'GET /api/admin/orders/o1': () => json(200, { ...detail, contact: { ...detail.contact, phone: null } }) });
    renderApp('/admin/orders/o1');
    expect(await screen.findByText('Telefon numarası yok')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'WhatsApp’tan yaz' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ara' })).toBeNull();
  });

  it("tags every message with the sender's language and translates the customer's message on request", async () => {
    let translateCalls = 0;
    const fetchMock = adminApi({
      'POST /api/admin/orders/o1/messages/m1/translate': (init) => {
        translateCalls += 1;
        expect(JSON.parse(String(init?.body))).toEqual({ targetLocale: 'tr' });
        return json(200, { messageId: 'm1', locale: 'tr', body: 'Mavi de olabilir mi?' });
      },
    });
    renderApp('/admin/orders/o1');
    expect(await screen.findByText('Kan het ook in het blauw?')).toBeTruthy();
    expect(screen.getByText('Mesajın dili: Nederlands')).toBeTruthy();
    expect(screen.getByText('Mesajın dili: Türkçe')).toBeTruthy();
    // Not translated automatically, and the artist's own message has no button.
    expect(translateCalls).toBe(0);
    expect(screen.getAllByRole('button', { name: 'Çevir' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Çevir' }));
    expect(await screen.findByText('Mavi de olabilir mi?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Orijinali göster' }));
    expect(screen.getByText('Kan het ook in het blauw?')).toBeTruthy();
    // Back to the translation without a new request.
    await user.click(screen.getByRole('button', { name: 'Çevir' }));
    expect(await screen.findByText('Mavi de olabilir mi?')).toBeTruthy();
    expect(translateCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('explains a failed translation and keeps the original', async () => {
    adminApi({
      'POST /api/admin/orders/o1/messages/m1/translate': () =>
        json(503, { error: { code: 'TRANSLATION_LIMIT_REACHED', message: 'quota' } }),
    });
    renderApp('/admin/orders/o1');
    await user.click(await screen.findByRole('button', { name: 'Çevir' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Bu ayki çeviri kotası doldu. Orijinal mesajı okuyabilirsiniz.');
    expect(screen.getByText('Kan het ook in het blauw?')).toBeTruthy();
  });

  it('has no translate button without a DeepL key', async () => {
    site.settings.translationAvailable = false;
    try {
      adminApi();
      renderApp('/admin/orders/o1');
      expect(await screen.findByText('Kan het ook in het blauw?')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Çevir' })).toBeNull();
    } finally {
      site.settings.translationAvailable = true;
    }
  });

  it('asks for a quote amount before sending a quote, and confirms first', async () => {
    let sent: unknown;
    adminApi({ 'POST /api/admin/orders/o1/status': (init) => ((sent = JSON.parse(String(init?.body))), json(200, detail)) });
    renderApp('/admin/orders/o1');
    expect(await screen.findByRole('heading', { level: 1, name: 'ORD-2026-7K3QXM' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Teklif gönderildi' }));
    await user.click(screen.getByRole('button', { name: 'Durumu değiştir' }));
    expect(await screen.findByText('Teklif tutarını girin.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.type(screen.getByLabelText(/Teklif tutarı/), '450');
    await user.click(screen.getByRole('button', { name: 'Durumu değiştir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Durum değiştirilsin mi?' });
    expect(within(dialog).getByText(/450/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Evet, değiştir' }));
    await waitFor(() => expect(sent).toEqual({ status: 'QUOTE_SENT', quoteAmount: 450 }));
  });

  it('shows internal notes in their own panel, marked as admin-only', async () => {
    adminApi();
    renderApp('/admin/orders/o1');
    const notes = await screen.findByRole('region', { name: 'İç notlar' });
    expect(within(notes).getByText('Sadece yöneticiler görür')).toBeTruthy();
    expect(within(notes).getByText('Marge is klein.')).toBeTruthy();
  });

  it('shows a new tracking link once and says honestly that it was not emailed', async () => {
    adminApi({
      'POST /api/admin/orders/o1/tracking-link': () =>
        json(201, { url: 'http://localhost:5173/track#new-token', expiresAt: '2027-11-04T10:00:00.000Z', emailSent: false }),
    });
    renderApp('/admin/orders/o1');
    await screen.findByRole('heading', { level: 1, name: 'ORD-2026-7K3QXM' });
    await user.click(screen.getByRole('button', { name: 'Yeni takip linki oluştur' }));
    const dialog = await screen.findByRole('dialog', { name: 'Yeni takip linki oluşturulsun mu?' });
    await user.click(within(dialog).getByRole('button', { name: 'Yeni takip linki oluştur' }));
    expect(((await screen.findByLabelText(/Yeni link/)) as HTMLInputElement).value).toBe('http://localhost:5173/track#new-token');
    expect(screen.getByText(/Müşterinin e-posta adresi yok/)).toBeTruthy();
    expect(screen.queryByText(/e-postayla gönderildi/)).toBeNull();
  });
});

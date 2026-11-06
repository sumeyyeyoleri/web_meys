import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategoryDto, AdminPortfolioItemDto } from '@painter/shared';
import { setLocale } from '../../../lib/i18n';
import { adminUser, json, mockApi, uid } from '../../../test/fixtures';
import { renderApp } from '../../../test/render';
import { titleFromFileName } from '../hooks';

const user = userEvent.setup();
beforeEach(() => setLocale('tr'));
afterEach(() => vi.unstubAllGlobals());

const names = (tr: string) => ({ 'nl-BE': { name: `${tr} NL` }, en: { name: `${tr} EN` }, tr: { name: tr } });
// Category ids are UUIDs (the work form checks them).
const CAT1 = uid('cat1');
const CAT2 = uid('cat2');
const horeca: AdminCategoryDto = { id: CAT1, slug: 'horeca', isVisible: true, sortOrder: 0, itemCount: 1, translations: names('Horeca') };
const gym: AdminCategoryDto = { id: CAT2, slug: 'gym', isVisible: false, sortOrder: 1, itemCount: 1, translations: names('Spor salonu') };
const titles = (tr: string) => ({ 'nl-BE': { title: `${tr} NL`, description: null }, en: { title: `${tr} EN`, description: null }, tr: { title: tr, description: null } });
const work = (id: string, title: string, categoryId: string | null, extra: Partial<AdminPortfolioItemDto> = {}): AdminPortfolioItemDto => ({
  id,
  imageUrl: `/media/${id}.webp`,
  categoryId,
  categoryHidden: false,
  width: null,
  height: null,
  unit: null,
  year: null,
  isFeatured: false,
  isPublished: true,
  isSample: false,
  allowSimilarRequest: true,
  sortOrder: 0,
  translations: titles(title),
  ...extra,
});
const works = [work('w1', 'Kafe duvarı', CAT1), work('w2', 'Spor salonu duvarı', CAT2, { categoryHidden: true }), work('w3', 'Eski eser', null, { isPublished: false })];

type Routes = NonNullable<NonNullable<Parameters<typeof mockApi>[0]>['routes']>;
function catalogApi(routes: Routes = {}) {
  return mockApi({
    user: { ...adminUser, preferredLocale: 'tr' },
    routes: {
      'GET /api/admin/stats': () => json(200, { total: 0, newOrders: 0, inReview: 0, inProgress: 0, completed: 0, unreadCustomerMessages: 0, recentOrders: [], recentMessages: [] }),
      'GET /api/admin/categories': () => json(200, [horeca, gym]),
      'GET /api/admin/portfolio': () => json(200, works),
      ...routes,
    },
  });
}

describe('categories page', () => {
  it('hides a category together with its works, with a button that says so', async () => {
    let sent: unknown;
    catalogApi({ [`POST /api/admin/categories/${CAT1}/visible`]: (init) => ((sent = JSON.parse(String(init?.body))), json(200, { ...horeca, isVisible: false })) });
    renderApp('/admin/categories');
    expect(await screen.findByText('Horeca')).toBeTruthy();
    expect(screen.getByText('Sitede gizli')).toBeTruthy(); // the gym category
    await user.click(screen.getByRole('button', { name: 'Kategoriyi ve eserlerini sitede gizle: Horeca' }));
    expect(await screen.findByText('Kategori ve eserleri sitede gizlendi.')).toBeTruthy();
    expect(sent).toEqual({ value: false });
    expect(screen.getByRole('button', { name: 'Kategoriyi ve eserlerini sitede göster: Spor salonu' })).toBeTruthy();
  });

  it('adds a category; all three names are required', async () => {
    let sent: Record<string, unknown> = {};
    catalogApi({ 'POST /api/admin/categories': (init) => ((sent = JSON.parse(String(init?.body))), json(201, { ...horeca, id: 'cat3' })) });
    renderApp('/admin/categories');
    await user.click(await screen.findByRole('button', { name: 'Kategori ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Yeni kategori' });
    await user.type(within(dialog).getByLabelText(/Ad \(Türkçe\)/), 'Düğün');
    await user.click(within(dialog).getByRole('button', { name: 'Kategoriyi kaydet' }));
    await waitFor(() => expect(within(dialog).getAllByText('Bu alan zorunludur.')).toHaveLength(2));
    await user.type(within(dialog).getByLabelText(/Ad \(Nederlands\)/), 'Bruiloften');
    await user.type(within(dialog).getByLabelText(/Ad \(English\)/), 'Weddings');
    await user.click(within(dialog).getByRole('button', { name: 'Kategoriyi kaydet' }));
    expect(await screen.findByText('Kategori kaydedildi.')).toBeTruthy();
    expect(sent).toMatchObject({ translations: { 'nl-BE': { name: 'Bruiloften' }, en: { name: 'Weddings' }, tr: { name: 'Düğün' } } });
  });

  it('asks where the works go when deleting a category that has works', async () => {
    let url = '';
    catalogApi({ [`DELETE /api/admin/categories/${CAT1}`]: (_init, u) => ((url = u.search), new Response(null, { status: 204 })) });
    renderApp('/admin/categories');
    await user.click(await screen.findByRole('button', { name: 'Sil: Horeca' }));
    const dialog = await screen.findByRole('dialog', { name: '“Horeca” silinsin mi?' });
    expect(within(dialog).getByText(/Eserler silinmez/)).toBeTruthy();
    // Default: move to another category (the only other one).
    await user.click(within(dialog).getByRole('button', { name: 'Kategoriyi sil' }));
    await waitFor(() => expect(url).toBe(`?moveTo=${CAT2}`));
  });

  it('can leave the works uncategorised instead', async () => {
    let url = 'unset';
    catalogApi({ [`DELETE /api/admin/categories/${CAT1}`]: (_init, u) => ((url = u.search), new Response(null, { status: 204 })) });
    renderApp('/admin/categories');
    await user.click(await screen.findByRole('button', { name: 'Sil: Horeca' }));
    const dialog = await screen.findByRole('dialog', { name: '“Horeca” silinsin mi?' });
    await user.click(within(dialog).getByRole('radio', { name: /Kategorisiz bırak/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Kategoriyi sil' }));
    await waitFor(() => expect(url).toBe(''));
  });
});

describe('catalog page', () => {
  it('lists the works with their state, marks works of a hidden category, and filters by category', async () => {
    catalogApi();
    renderApp('/admin/catalog');
    const hiddenWork = (await screen.findByText('Spor salonu duvarı')).closest('li')!;
    expect(within(hiddenWork).getByText('Kategori gizli')).toBeTruthy();
    const draft = screen.getByText('Eski eser').closest('li')!;
    expect(within(draft).getByText('Taslak')).toBeTruthy();
    expect(within(draft).getByText('Kategorisiz')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Kategori'), CAT1);
    expect(screen.queryByText('Spor salonu duvarı')).toBeNull();
    expect(screen.getByText('Kafe duvarı')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Kategori'), 'none');
    expect(screen.getByText('Eski eser')).toBeTruthy();
    expect(screen.queryByText('Kafe duvarı')).toBeNull();
  });

  it('edits a work and picks its category from the list', async () => {
    let sent: Record<string, unknown> = {};
    catalogApi({ 'PUT /api/admin/portfolio/w3': (init) => ((sent = JSON.parse(String(init?.body))), json(200, works[2])) });
    renderApp('/admin/catalog');
    await user.click(await screen.findByRole('button', { name: 'Düzenle: Eski eser' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eseri düzenle' });
    await user.selectOptions(within(dialog).getByLabelText('Kategori'), CAT2);
    // Choosing a hidden category explains what that means.
    expect(within(dialog).getByText(/Bu kategori gizli/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Eseri kaydet' }));
    expect(await screen.findByText('Eser kaydedildi.')).toBeTruthy();
    expect(sent).toMatchObject({ categoryId: CAT2, imageUrl: '/media/w3.webp', translations: { tr: { title: 'Eski eser' } } });
  });

  it('publishes a draft with one click', async () => {
    let sent: unknown;
    catalogApi({ 'POST /api/admin/portfolio/w3/published': (init) => ((sent = JSON.parse(String(init?.body))), json(200, { ...works[2], isPublished: true })) });
    renderApp('/admin/catalog');
    await user.click(await screen.findByRole('button', { name: 'Yayınla: Eski eser' }));
    expect(await screen.findByText('Eser yayında.')).toBeTruthy();
    expect(sent).toEqual({ value: true });
  });

  it('uploads several photos into one category as drafts', async () => {
    const created: Array<Record<string, unknown>> = [];
    let uploads = 0;
    catalogApi({
      'POST /api/admin/media': () => json(201, { url: `/media/uploads/${++uploads}.webp` }),
      'POST /api/admin/portfolio': (init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        created.push(body);
        return json(201, work(`n${created.length}`, 'x', CAT1));
      },
    });
    renderApp('/admin/catalog');
    await user.click(await screen.findByRole('button', { name: 'Toplu yükle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Toplu yükle' });
    await user.selectOptions(within(dialog).getByLabelText('Kategori'), CAT1);
    const files = ['kepenk_gent.jpg', 'vitrin-brugge.png'].map((name) => new File(['x'], name, { type: name.endsWith('png') ? 'image/png' : 'image/jpeg' }));
    await user.upload(within(dialog).getByLabelText('Fotoğrafları seç'), files);
    expect(within(dialog).getByText('2 fotoğraf seçildi.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '2 fotoğrafı yükle' }));
    expect(await screen.findByText('2 eser taslak olarak eklendi.')).toBeTruthy();
    expect(created).toEqual([
      expect.objectContaining({ imageUrl: '/media/uploads/1.webp', categoryId: CAT1, isPublished: false, translations: { 'nl-BE': { title: 'kepenk gent' }, en: { title: 'kepenk gent' }, tr: { title: 'kepenk gent' } } }),
      expect.objectContaining({ imageUrl: '/media/uploads/2.webp', categoryId: CAT1, isPublished: false }),
    ]);
  });

  it('makes a title from the file name', () => {
    expect(titleFromFileName('IMG_2041 kepenk-gent.JPG')).toBe('IMG 2041 kepenk gent');
    expect(titleFromFileName('.jpg')).toBe('Foto');
  });
});

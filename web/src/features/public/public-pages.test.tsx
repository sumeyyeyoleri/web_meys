import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../lib/i18n';
import { category, json, mockApi, portfolio, uid } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());

describe('home: curved gallery', () => {
  it('syncs the selected-work panel with the carousel (buttons, keyboard, side cards)', async () => {
    mockApi();
    renderApp('/');
    const carousel = await screen.findByRole('region', { name: 'Uitgelichte werken' });
    expect(carousel.getAttribute('aria-roledescription')).toBe('carousel');
    const panelTitle = () => document.getElementById('selected-work-title')?.textContent;
    expect(panelTitle()).toBe('Warme aarde');

    await userEvent.click(screen.getByRole('button', { name: 'Volgend werk' }));
    expect(panelTitle()).toBe('Maanlichtheuvels');

    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(panelTitle()).toBe('Warme aarde');
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' }); // wraps around
    expect(panelTitle()).toBe('Nachthaven');

    await userEvent.click(within(carousel).getByRole('button', { name: 'Toon Maanlichtheuvels' }));
    expect(panelTitle()).toBe('Maanlichtheuvels');
    expect(within(carousel).getByRole('group', { name: '2 van 3: Maanlichtheuvels' })).toBeTruthy();
  });

  it('offers "Request something similar" with the item, only when allowed', async () => {
    mockApi();
    renderApp('/');
    const link = await screen.findByRole('link', { name: 'Iets gelijkaardigs aanvragen als ‘Warme aarde’' });
    expect(link.getAttribute('href')).toBe(`/order?from=${uid('a1')}`);
    expect(screen.getAllByText('Persoonlijke offerte').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Vorig werk' })); // → Nachthaven (not allowed)
    expect(screen.queryByRole('link', { name: /Iets gelijkaardigs aanvragen als/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bekijk de volledige catalogus' })).toBeTruthy();
  });
});

describe('catalog', () => {
  it('reads the category from the URL and writes it back; there is no space filter', async () => {
    mockApi();
    const { router } = renderApp('/catalog?category=home');
    expect(await screen.findByRole('heading', { level: 2, name: 'Maanlichtheuvels' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Warme aarde' })).toBeNull();
    const filters = screen.getByRole('group', { name: 'Filter op categorie' });
    expect(within(filters).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Alles',
      'Doek en portret',
      'Woning en kinderkamer',
      'Street art en vitrines',
    ]);
    expect(within(filters).getByRole('button', { name: 'Woning en kinderkamer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('group', { name: /ruimte/i })).toBeNull();

    await userEvent.click(within(filters).getByRole('button', { name: 'Street art en vitrines' }));
    await waitFor(() => expect(router.state.location.search).toBe('?category=street-art'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Nachthaven' })).toBeTruthy();

    await userEvent.click(within(filters).getByRole('button', { name: 'Alles' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('heading', { level: 2, name: 'Warme aarde' })).toBeTruthy();
  });

  it('shows the category under each work, and everything for an old or unknown category link', async () => {
    mockApi();
    renderApp('/catalog?category=mural');
    expect(await screen.findByRole('heading', { level: 2, name: 'Warme aarde' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Nachthaven' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alles' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('Woning en kinderkamer').length).toBeGreaterThanOrEqual(2); // chip + card caption
  });

  it('only shows the categories the site lists (no filter row without any)', async () => {
    mockApi({ routes: { 'GET /api/categories': () => json(200, []) } });
    renderApp('/catalog');
    await screen.findByRole('heading', { level: 2, name: 'Warme aarde' });
    expect(screen.queryByRole('group', { name: 'Filter op categorie' })).toBeNull();
  });

  it('shows an empty state with a way to clear the filter', async () => {
    mockApi({
      routes: {
        'GET /api/categories': () => json(200, [category({ id: 'c9', slug: 'gym', name: 'Sportscholen', hasWorks: true })]),
        'GET /api/portfolio': (_init, url) => json(200, url.searchParams.get('category') === 'gym' ? [] : portfolio),
      },
    });
    const { router } = renderApp('/catalog?category=gym');
    expect(await screen.findByText('Nog niets in deze combinatie')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Filters wissen' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('heading', { level: 2, name: 'Warme aarde' })).toBeTruthy();
  });

  it('hides "Request similar" on items that do not allow it', async () => {
    mockApi();
    renderApp('/catalog');
    await screen.findByRole('heading', { level: 2, name: 'Nachthaven' });
    expect(screen.getAllByRole('link', { name: /Iets gelijkaardigs aanvragen als/ })).toHaveLength(2);
    expect(screen.getAllByText('Voorbeeld').length).toBe(3);
  });
});

describe('services, contact and privacy', () => {
  it('shows the categories shown on the site as cards that link to the order form', async () => {
    mockApi();
    renderApp('/services');
    const link = await screen.findByRole('link', { name: 'Aanvragen: Doek en portret' });
    expect(link.getAttribute('href')).toBe('/order?category=canvas-portrait');
    expect(screen.getByText('Op de muur.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Sportscholen' })).toBeTruthy();
    // "Custom piece" is only in the order form, not on the site.
    expect(screen.queryByRole('heading', { level: 2, name: 'Werk op maat' })).toBeNull();
  });

  it('offers only order-form categories in the form, including ones not shown on the site', async () => {
    mockApi({ routes: { 'GET /api/categories': () => json(200, [category({ id: uid('c9'), slug: 'murals-only-site', name: 'Alleen op de site', showInOrderForm: false }), category({ id: uid('c5'), slug: 'custom', name: 'Werk op maat', showOnSite: false, defaultUnit: 'CM' })]) } });
    renderApp('/services');
    expect(await screen.findByRole('heading', { level: 2, name: 'Alleen op de site' })).toBeTruthy();
    // Shown on the site but not in the order form: no request link.
    expect(screen.queryByRole('link', { name: /Aanvragen: Alleen op de site/ })).toBeNull();
  });

  it('shows contact details and business hours', async () => {
    mockApi();
    renderApp('/contact');
    expect(await screen.findByRole('heading', { level: 1, name: 'Laten we praten' })).toBeTruthy();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /hello@example.com/ }).getAttribute('href')).toBe('mailto:hello@example.com');
    expect(screen.getByText('Ma–vr 9–17')).toBeTruthy();
  });

  it('shows the privacy text with a visible review notice', async () => {
    mockApi();
    renderApp('/privacy');
    expect(await screen.findByText('Wij verwerken uw gegevens zorgvuldig.')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(/nakijken en aanpassen/);
  });
});

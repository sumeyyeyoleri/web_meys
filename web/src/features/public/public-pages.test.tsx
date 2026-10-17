import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../lib/i18n';
import { mockApi } from '../../test/fixtures';
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
    expect(link.getAttribute('href')).toBe('/order?from=a1');
    expect(screen.getAllByText('Persoonlijke offerte').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Vorig werk' })); // → Nachthaven (not allowed)
    expect(screen.queryByRole('link', { name: /Iets gelijkaardigs aanvragen als/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bekijk de volledige catalogus' })).toBeTruthy();
  });
});

describe('catalog', () => {
  it('reads filters from the URL and writes them back', async () => {
    mockApi();
    const { router } = renderApp('/catalog?category=mural&space=kids');
    expect(await screen.findByRole('heading', { level: 2, name: 'Maanlichtheuvels' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Warme aarde' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Muurschildering' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Kinderkamer' }).getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Alle ruimtes' }));
    await waitFor(() => expect(router.state.location.search).toBe('?category=mural'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Nachthaven' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Buiten' }));
    await waitFor(() => expect(router.state.location.search).toBe('?category=mural&space=outdoor'));
  });

  it('shows an empty state with a way to clear the filters', async () => {
    mockApi();
    const { router } = renderApp('/catalog?category=portrait');
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
  it('links every service to the order form with that service preselected', async () => {
    mockApi();
    renderApp('/services');
    const link = await screen.findByRole('link', { name: 'Muurschildering aanvragen' });
    expect(link.getAttribute('href')).toBe('/order?service=s2');
    expect(screen.getByText('Op de muur')).toBeTruthy();
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

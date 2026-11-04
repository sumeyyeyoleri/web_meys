import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../lib/i18n';
import { adminUser, mockApi } from '../test/fixtures';
import { renderApp } from '../test/render';

describe('app shell', () => {
  beforeEach(() => setLocale('nl-BE'));
  afterEach(() => vi.unstubAllGlobals());

  it('renders navigation, hero and footer from the site settings', async () => {
    mockApi();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kunst op maat' })).toBeTruthy();
    const nav = screen.getAllByRole('navigation', { name: 'Hoofdnavigatie' })[0]!;
    expect(within(nav).getByRole('link', { name: 'Catalogus' }).getAttribute('href')).toBe('/catalog');
    // No customer accounts: no login icon, account menu or notification bell for visitors.
    expect(screen.queryByRole('link', { name: 'Aanmelden' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Meldingen/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.getByRole('link', { name: /Naar de inhoud/ }).getAttribute('href')).toBe('#main');
    expect(await screen.findByText('Alle afbeeldingen op deze site zijn voorbeelden.')).toBeTruthy();
    // Dark accent → white text for contrast.
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--color-on-accent')).toBe('#FFFFFF'));
    expect(document.title).toContain('Atelier Test');
  });

  it('shows the 404 page for unknown routes', async () => {
    mockApi();
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Deze zaal is leeg' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Naar de catalogus' })).toBeTruthy();
  });

  it('only shows a link to the dashboard while the artist is signed in', async () => {
    mockApi({ user: adminUser });
    renderApp('/');
    expect((await screen.findAllByRole('link', { name: 'Dashboard' }))[0]!.getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('button', { name: /Meldingen/ })).toBeNull();
  });

  it('has no customer account pages', async () => {
    mockApi();
    for (const path of ['/login', '/register', '/forgot-password', '/account/orders']) {
      const { unmount } = renderApp(path);
      expect(await screen.findByRole('heading', { level: 1, name: 'Deze zaal is leeg' })).toBeTruthy();
      unmount();
    }
  });
});

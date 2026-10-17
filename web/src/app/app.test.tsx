import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../lib/i18n';
import { customer, mockApi } from '../test/fixtures';
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
    expect(screen.getByRole('link', { name: 'Aanmelden' })).toBeTruthy();
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

  it('shows the notifications bell with the unread count for signed-in users', async () => {
    mockApi({ user: customer, unread: 3 });
    renderApp('/');
    expect((await screen.findAllByRole('button', { name: 'Meldingen, 3 ongelezen' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Accountmenu' }).length).toBeGreaterThan(0);
  });
});

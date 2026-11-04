import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicSettingsDto } from '@painter/shared';
import { AppProviders } from '../../app/providers';
import { setLocale } from '../../lib/i18n';
import { json, mockApi, portfolio, site } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { BrandMark, splitWordmark } from '../layout/BrandMark';
import { WELCOME_SEEN_KEY } from './WelcomeScreen';

const withSettings = (settings: Partial<PublicSettingsDto>) =>
  mockApi({ routes: { 'GET /api/site': () => json(200, { ...site, settings: { ...site.settings, ...settings } }) } });

beforeEach(() => {
  setLocale('nl-BE');
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('welcome screen', () => {
  it('greets first-time visitors on the home page over the rendered page', async () => {
    withSettings({ welcomeEnabled: true });
    renderApp('/');
    const dialog = await screen.findByRole('dialog', { name: 'Welkom' });
    expect(dialog.textContent).toContain('Handgeschilderde kunst, gemaakt voor uw ruimte.');
    // The page itself is rendered underneath.
    expect(screen.getByRole('heading', { level: 1, name: 'Kunst op maat' })).toBeTruthy();
    // Falls back to the first featured artwork as background.
    await waitFor(() => expect(dialog.querySelector('img')?.getAttribute('src')).toBe(portfolio[0]!.imageUrl));

    const enter = screen.getByRole('button', { name: 'Betreed de galerie' });
    await waitFor(() => expect(document.activeElement).toBe(enter));
    await userEvent.click(enter);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull());
    expect(window.sessionStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');
  });

  it('is dismissed with Esc or Skip and uses the chosen background', async () => {
    withSettings({ welcomeEnabled: true, welcomeImageUrl: '/media/uploads/welcome.png' });
    const { unmount } = renderApp('/');
    const dialog = await screen.findByRole('dialog', { name: 'Welkom' });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/media/uploads/welcome.png');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull());
    unmount();

    window.sessionStorage.clear();
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Overslaan' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull());
  });

  it('shows only once per session, only on the home page and only when enabled', async () => {
    withSettings({ welcomeEnabled: true });
    window.sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
    const first = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Kunst op maat' });
    expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull();
    first.unmount();

    window.sessionStorage.clear();
    const catalog = renderApp('/catalog');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull();
    catalog.unmount();

    withSettings({ welcomeEnabled: false });
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Kunst op maat' });
    expect(screen.queryByRole('dialog', { name: 'Welkom' })).toBeNull();
  });
});

describe('brand mark', () => {
  it('splits camel-case names into a wordmark', () => {
    expect(splitWordmark('MeysArt')).toEqual(['Meys', 'Art']);
    expect(splitWordmark('Atelier Noor')).toBeNull();
    expect(splitWordmark('ATELIER')).toBeNull();
  });

  it('shows the wordmark, or the uploaded logo instead', async () => {
    withSettings({ businessName: 'MeysArt' });
    const wordmark = render(
      <AppProviders>
        <BrandMark />
      </AppProviders>,
    );
    const accent = await screen.findByText('Art');
    expect(accent.tagName).toBe('EM');
    expect(accent.parentElement?.textContent).toBe('MeysArt');
    wordmark.unmount();

    withSettings({ businessName: 'MeysArt', logoUrl: '/media/uploads/logo/x.svg' });
    render(
      <AppProviders>
        <BrandMark />
      </AppProviders>,
    );
    const logo = await screen.findByRole('img', { name: 'MeysArt' });
    expect(logo.getAttribute('src')).toBe('/media/uploads/logo/x.svg');
  });
});

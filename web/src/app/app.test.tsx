import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../lib/i18n';
import { AppProviders } from './providers';
import { routes } from './router';

const site = {
  locale: 'nl-BE',
  settings: {
    businessName: 'Atelier Test',
    accentColor: '#1F3A5F',
    instagramUrl: 'https://www.instagram.com/example',
    contactEmail: 'hello@example.com',
    contactPhone: '+32 470 00 00 00',
    contactAddress: 'Straat 1, Gent',
    enabledLocales: ['nl-BE', 'en', 'tr'],
    budgetRequired: false,
    deadlineRequired: false,
  },
  content: { 'hero.title': 'Kunst op maat', 'hero.subtitle': 'Vertel wat u wilt.', 'footer.tagline': 'Handgeschilderd.' },
};

function mockApi(user: unknown = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.startsWith('/api/site')
        ? site
        : url.startsWith('/api/auth/me')
          ? { user }
          : url.startsWith('/api/portfolio')
            ? [{ id: '1', isSample: true }]
            : url.startsWith('/api/notifications/unread-count')
              ? { count: 3 }
              : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('app shell', () => {
  beforeEach(() => setLocale('nl-BE'));
  afterEach(() => vi.unstubAllGlobals());

  it('renders navigation, hero and footer from the site settings', async () => {
    mockApi();
    renderAt('/');
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
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Deze zaal is leeg' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Naar de catalogus' })).toBeTruthy();
  });

  it('shows the notifications bell with the unread count for signed-in users', async () => {
    mockApi({ id: 'u1', email: 'a@b.c', role: 'CUSTOMER', preferredLocale: 'nl-BE', profile: null, createdAt: '' });
    renderAt('/');
    expect((await screen.findAllByRole('button', { name: 'Meldingen, 3 ongelezen' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Accountmenu' }).length).toBeGreaterThan(0);
  });
});

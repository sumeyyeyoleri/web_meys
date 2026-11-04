import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { setLocale } from '../../lib/i18n';
import { safeNextPath } from '../../lib/form-errors';
import { adminUser, json, mockApi, site } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());
const user = userEvent.setup();

describe('admin login (/admin/login)', () => {
  it('is a separate dark page with the brand and the title "Dashboard", without the public navigation', async () => {
    mockApi();
    renderApp('/admin/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText(/Klanten hebben geen account nodig/)).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Hoofdnavigatie' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Wachtwoord vergeten?' }).getAttribute('href')).toBe('/admin/forgot-password');
  });

  it('signs in, switches to the preferred language and returns to "next"', async () => {
    mockApi({ routes: { 'POST /api/auth/login': () => json(200, { ...adminUser, preferredLocale: 'en' }) } });
    const { router } = renderApp('/admin/login?next=%2Fcatalog');
    await user.type(await screen.findByLabelText('E-mailadres'), 'atelier@example.com');
    await user.type(screen.getByLabelText('Wachtwoord', { selector: 'input' }), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Aanmelden' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog'));
    expect(i18n.language).toBe('en');
  });

  it('shows one generic message for wrong credentials', async () => {
    mockApi({
      routes: { 'POST /api/auth/login': () => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }) },
    });
    renderApp('/admin/login');
    await user.type(await screen.findByLabelText('E-mailadres'), 'atelier@example.com');
    await user.type(screen.getByLabelText('Wachtwoord', { selector: 'input' }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Aanmelden' }));
    expect((await screen.findByRole('alert')).textContent).toBe('E-mailadres of wachtwoord is niet juist.');
  });

  it('leads /admin to the login until the dashboard exists', async () => {
    mockApi();
    const { router } = renderApp('/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
  });

  it('never redirects to another site after login', () => {
    expect(safeNextPath('/catalog')).toBe('/catalog');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('admin forgot and reset password', () => {
  it('confirms the request without revealing whether the address is the admin one', async () => {
    mockApi({ routes: { 'POST /api/auth/forgot-password': () => json(202, { ok: true }) } });
    renderApp('/admin/forgot-password');
    await user.type(await screen.findByLabelText('E-mailadres'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Link versturen' }));
    expect(await screen.findByText(/Als someone@example.com het beheerdersadres is/)).toBeTruthy();
  });

  it('explains the ADMIN_PASSWORD route when SMTP is not configured', async () => {
    const original = site.settings.emailAvailable;
    site.settings.emailAvailable = false;
    try {
      mockApi();
      renderApp('/admin/forgot-password');
      expect(await screen.findByText(/Wijzig ADMIN_PASSWORD in het .env-bestand/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Link versturen' })).toBeNull();
    } finally {
      site.settings.emailAvailable = original;
    }
  });

  it('handles a missing token and an expired token', async () => {
    mockApi({
      routes: {
        'POST /api/auth/reset-password': () =>
          json(400, { error: { code: 'RESET_TOKEN_INVALID', message: 'bad', fields: { token: 'validation.resetTokenInvalid' } } }),
      },
    });
    const { unmount } = renderApp('/admin/reset-password');
    expect(await screen.findByText(/Deze link is onvolledig/)).toBeTruthy();
    unmount();

    renderApp('/admin/reset-password?token=abc');
    await user.type(await screen.findByLabelText('Nieuw wachtwoord', { selector: 'input' }), 'brand-new-pass');
    await user.type(screen.getByLabelText('Herhaal het wachtwoord', { selector: 'input' }), 'brand-new-pass');
    await user.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }));
    expect(await screen.findByText(/Deze link is ongeldig of verlopen/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nieuwe link aanvragen' }).getAttribute('href')).toBe('/admin/forgot-password');
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { setLocale } from '../../lib/i18n';
import { customer, json, mockApi, site } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { safeNextPath } from '../../lib/form-errors';

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());
const user = userEvent.setup();

describe('login', () => {
  it('signs in, switches to the preferred language and returns to "next"', async () => {
    mockApi({ routes: { 'POST /api/auth/login': () => json(200, { ...customer, preferredLocale: 'en' }) } });
    const { router } = renderApp('/login?next=%2Fcatalog');
    await user.type(await screen.findByLabelText('E-mailadres'), 'anna@example.com');
    await user.type(screen.getByLabelText('Wachtwoord', { selector: 'input' }), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Aanmelden' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog'));
    expect(i18n.language).toBe('en');
  });

  it('shows one generic message for wrong credentials', async () => {
    mockApi({
      routes: { 'POST /api/auth/login': () => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }) },
    });
    renderApp('/login');
    await user.type(await screen.findByLabelText('E-mailadres'), 'anna@example.com');
    await user.type(screen.getByLabelText('Wachtwoord', { selector: 'input' }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Aanmelden' }));
    expect((await screen.findByRole('alert')).textContent).toBe('E-mailadres of wachtwoord is niet juist.');
  });

  it('never redirects to another site after login', () => {
    expect(safeNextPath('/account/orders')).toBe('/account/orders');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('register', () => {
  it('shows field errors from the API next to the fields', async () => {
    mockApi({
      routes: {
        'POST /api/auth/register': () =>
          json(409, { error: { code: 'EMAIL_IN_USE', message: 'in use', fields: { email: 'validation.emailInUse' } } }),
      },
    });
    renderApp('/register');
    await user.type(await screen.findByLabelText('Volledige naam'), 'Anna');
    await user.type(screen.getByLabelText('E-mailadres'), 'anna@example.com');
    await user.type(screen.getByLabelText('Wachtwoord', { selector: 'input' }), 'long-enough-1');
    await user.type(screen.getByLabelText('Herhaal het wachtwoord', { selector: 'input' }), 'long-enough-1');
    await user.click(screen.getByRole('button', { name: 'Account aanmaken' }));
    expect(await screen.findByText('Er bestaat al een account met dit e-mailadres.')).toBeTruthy();
    expect(screen.getByLabelText('E-mailadres').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('forgot and reset password', () => {
  it('confirms the request without revealing whether the account exists', async () => {
    mockApi({ routes: { 'POST /api/auth/forgot-password': () => json(202, { ok: true }) } });
    renderApp('/forgot-password');
    await user.type(await screen.findByLabelText('E-mailadres'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Link aanvragen' }));
    expect(await screen.findByText(/Als er een account bestaat voor someone@example.com/)).toBeTruthy();
  });

  it('says honestly that no email can be sent when SMTP is not configured', async () => {
    const original = site.settings.emailAvailable;
    site.settings.emailAvailable = false;
    try {
      mockApi();
      renderApp('/forgot-password');
      expect(await screen.findByText(/kunnen momenteel niet verstuurd worden/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Link aanvragen' })).toBeNull();
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
    const { unmount } = renderApp('/reset-password');
    expect(await screen.findByText(/Deze link is onvolledig/)).toBeTruthy();
    unmount();

    renderApp('/reset-password?token=abc');
    await user.type(await screen.findByLabelText('Nieuw wachtwoord', { selector: 'input' }), 'brand-new-pass');
    await user.type(screen.getByLabelText('Herhaal het wachtwoord', { selector: 'input' }), 'brand-new-pass');
    await user.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }));
    expect(await screen.findByText(/Deze link is ongeldig of verlopen/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nieuwe link aanvragen' }).getAttribute('href')).toBe('/forgot-password');
  });
});

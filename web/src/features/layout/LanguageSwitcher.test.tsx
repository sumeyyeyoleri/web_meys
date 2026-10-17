import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { setLocale } from '../../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

function renderSwitcher(enabledLocales = ['nl-BE', 'en', 'tr']) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ locale: 'nl-BE', content: {}, settings: { enabledLocales, businessName: 'X', accentColor: '#E8D3A8' } }), {
        status: 200,
      }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageSwitcher />
    </QueryClientProvider>,
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(() => setLocale('nl-BE'));
  afterEach(() => vi.unstubAllGlobals());

  it('switches language, persists it and updates <html lang>', async () => {
    renderSwitcher();
    const english = screen.getByRole('button', { name: 'English' });
    expect(screen.getByRole('button', { name: 'Nederlands' })).toHaveProperty('ariaPressed', 'true');

    await userEvent.click(english);
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('painter.locale')).toBe('en');
    expect(english.getAttribute('aria-pressed')).toBe('true');
  });

  it('only offers languages the admin enabled (Dutch always stays)', async () => {
    renderSwitcher(['nl-BE', 'en']);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Türkçe' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Nederlands' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
  });
});

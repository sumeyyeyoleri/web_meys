import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, resetCsrfToken } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    resetCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends cookies and no CSRF header on GET', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.get('/api/site', { locale: 'tr', empty: '' })).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/site?locale=tr');
    expect(init?.credentials).toBe('include');
    expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('fetches a CSRF token once and sends it on mutations', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { csrfToken: 'tok.sig' }))
      .mockResolvedValueOnce(json(200, { id: 1 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.post('/api/orders/1/messages', { body: 'Hi' });
    await api.post('/api/auth/logout');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const headers = fetchMock.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('tok.sig');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('refreshes the token and retries once when it was rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { csrfToken: 'old.sig' }))
      .mockResolvedValueOnce(json(403, { error: { code: 'CSRF_INVALID', message: 'bad' } }))
      .mockResolvedValueOnce(json(200, { csrfToken: 'new.sig' }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api.post('/api/auth/login', {})).resolves.toEqual({ ok: true });
    expect((fetchMock.mock.calls[3]![1]!.headers as Record<string, string>)['X-CSRF-Token']).toBe('new.sig');
  });

  it('turns the error envelope into an ApiError with field keys', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { csrfToken: 't.s' })).mockResolvedValueOnce(
      json(400, { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: { email: 'validation.email' } } }),
    );
    const error = await api.post('/api/auth/register', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', fields: { email: 'validation.email' } });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/api/site')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

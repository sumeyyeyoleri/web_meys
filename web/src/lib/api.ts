import type { ApiErrorBody, ErrorCode } from '@painter/shared';

/**
 * The single API client. Sends cookies, adds the CSRF header to every non-GET request
 * (fetching the token on demand and retrying once if it was rejected), and turns the
 * API's error envelope into an `ApiError`.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    /** Field path → i18n validation key. */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown, code?: ApiError['code']): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfRequest ??= fetch(`${BASE_URL}/api/auth/csrf`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, 'CSRF_INVALID', 'Could not obtain a CSRF token');
      csrfToken = ((await res.json()) as { csrfToken: string }).csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

/** Forget the cached token (e.g. after logout the server may issue a new one). */
export function resetCsrfToken() {
  csrfToken = null;
}

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.fields ?? {});
  } catch {
    // Non-JSON error (e.g. a proxy error page).
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', res.statusText || 'Request failed');
}

async function request<T>(method: string, path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  if (!res.ok) {
    const error = await toApiError(res);
    if (error.code === 'CSRF_INVALID' && !retried) {
      resetCsrfToken();
      return request<T>(method, path, options, true);
    }
    throw error;
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T = void>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T = void>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T = void>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Absolute URL for API-served media (`/media/...`, `/api/attachments/...`). */
export function mediaUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
}

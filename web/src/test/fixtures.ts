import type { PortfolioItemDto, ServiceDto, SiteDto, UserDto } from '@painter/shared';
import { vi } from 'vitest';

/** Readable test ids that are valid UUIDs, e.g. uid('a2'). */
export const uid = (short: string) =>
  `00000000-0000-4000-8000-${[...short].map((c) => c.charCodeAt(0).toString(16)).join('').padStart(12, '0')}`;

export const site: SiteDto = {
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
    emailAvailable: true,
  },
  content: {
    'hero.title': 'Kunst op maat',
    'hero.subtitle': 'Vertel wat u wilt.',
    'footer.tagline': 'Handgeschilderd.',
    'contact.businessHours': 'Ma–vr 9–17',
    'privacy.body': 'Wij verwerken uw gegevens zorgvuldig.',
  },
};

export function artwork(overrides: Partial<PortfolioItemDto> & { id: string; title: string }): PortfolioItemDto {
  return {
    description: 'Acryl op doek.',
    category: 'PAINTING',
    imageUrl: `/media/portfolio/${overrides.title.toLowerCase().replace(/\s+/g, '-')}.svg`,
    width: 100,
    height: 80,
    unit: 'CM',
    year: 2025,
    isFeatured: true,
    isSample: true,
    spaces: ['LIVING_ROOM'],
    allowSimilarRequest: true,
    ...overrides,
  };
}

export const portfolio: PortfolioItemDto[] = [
  artwork({ id: uid('a1'), title: 'Warme aarde' }),
  artwork({ id: uid('a2'), title: 'Maanlichtheuvels', category: 'MURAL', spaces: ['KIDS_ROOM', 'BEDROOM'], unit: 'M', width: 3.6, height: 2.4 }),
  artwork({ id: uid('a3'), title: 'Nachthaven', category: 'MURAL', spaces: ['OUTDOOR'], allowSimilarRequest: false }),
];

export const services: ServiceDto[] = [
  { id: uid('s1'), name: 'Schilderij op maat', description: 'Uniek werk.', imageUrl: null, isWallService: false },
  { id: uid('s2'), name: 'Muurschildering', description: 'Op de muur.', imageUrl: null, isWallService: true },
];

export const customer: UserDto = {
  id: 'u1',
  email: 'anna@example.com',
  role: 'CUSTOMER',
  preferredLocale: 'nl-BE',
  profile: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Fake API: routes GET requests by path prefix. Portfolio filtering mimics the server
 * (category / space / featured query parameters).
 */
type Handler = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>;

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function mockApi(options: { user?: UserDto | null; unread?: number; routes?: Record<string, Handler> } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const p = url.pathname;
    const custom = options.routes?.[`${init?.method ?? 'GET'} ${p}`];
    if (custom) return custom(init, url);
    let body: unknown = {};
    if (p === '/api/site') body = site;
    else if (p === '/api/auth/me') body = { user: options.user ?? null };
    else if (p === '/api/services') body = services;
    else if (p === '/api/portfolio') {
      const category = url.searchParams.get('category');
      const space = url.searchParams.get('space');
      const featured = url.searchParams.get('featured');
      body = portfolio.filter(
        (item) =>
          (!category || item.category === category) &&
          (!space || item.spaces.includes(space as never)) &&
          (!featured || item.isFeatured),
      );
    } else if (p === '/api/notifications/unread-count') body = { count: options.unread ?? 0 };
    else if (p === '/api/auth/csrf') body = { csrfToken: 'test.token' };
    else if (p.startsWith('/api/portfolio/')) {
      const item = portfolio.find((i) => i.id === p.split('/').pop());
      return item ? json(200, item) : json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

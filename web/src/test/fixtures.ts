import type { PortfolioItemDto, ServiceDto, SiteDto, UserDto } from '@painter/shared';
import { vi } from 'vitest';

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
    imageUrl: `/media/portfolio/${overrides.id}.svg`,
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
  artwork({ id: 'a1', title: 'Warme aarde' }),
  artwork({ id: 'a2', title: 'Maanlichtheuvels', category: 'MURAL', spaces: ['KIDS_ROOM', 'BEDROOM'], unit: 'M', width: 3.6, height: 2.4 }),
  artwork({ id: 'a3', title: 'Nachthaven', category: 'MURAL', spaces: ['OUTDOOR'], allowSimilarRequest: false }),
];

export const services: ServiceDto[] = [
  { id: 's1', name: 'Schilderij op maat', description: 'Uniek werk.', imageUrl: null, isWallService: false },
  { id: 's2', name: 'Muurschildering', description: 'Op de muur.', imageUrl: null, isWallService: true },
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
export function mockApi(options: { user?: UserDto | null; unread?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const p = url.pathname;
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
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

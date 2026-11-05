import { describe, expect, it } from 'vitest';
import type { CategoryDto, ServiceDto } from '@painter/shared';
import { matchServiceForCategory } from './service-match';

const service = (slug: string, isWallService: boolean): ServiceDto => ({
  id: slug,
  slug,
  name: slug,
  description: null,
  imageUrl: null,
  isWallService,
  defaultUnit: isWallService ? 'M' : 'CM',
});
const services = [service('mural', true), service('shutter-window', true), service('canvas-painting', false), service('custom-piece', false)];
const category = (slug: string): CategoryDto => ({ id: slug, slug, name: slug });

describe('matchServiceForCategory', () => {
  it('maps the starting categories to their service', () => {
    for (const slug of ['horeca', 'gym', 'shops', 'home']) expect(matchServiceForCategory(services, category(slug))?.id).toBe('mural');
    expect(matchServiceForCategory(services, category('street-art'))?.id).toBe('shutter-window');
    expect(matchServiceForCategory(services, category('canvas-portrait'))?.id).toBe('canvas-painting');
  });

  it('selects nothing for new categories, uncategorised works and switched-off services', () => {
    expect(matchServiceForCategory(services, category('weddings'))).toBeUndefined();
    expect(matchServiceForCategory(services, null)).toBeUndefined();
    expect(matchServiceForCategory(services.filter((s) => s.slug !== 'mural'), category('horeca'))).toBeUndefined();
  });
});

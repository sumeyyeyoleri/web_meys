import { describe, expect, it } from 'vitest';
import type { ServiceDto } from '@painter/shared';
import { matchServiceForCategory } from './service-match';

const services: ServiceDto[] = [
  { id: 'canvas', name: 'Schilderij op maat', description: null, imageUrl: null, isWallService: false },
  { id: 'mural', name: 'Muurschildering', description: null, imageUrl: null, isWallService: true },
  { id: 'portrait', name: 'Portret', description: null, imageUrl: null, isWallService: false },
  { id: 'deco', name: 'Decoratief schilderwerk', description: null, imageUrl: null, isWallService: true },
];

describe('matchServiceForCategory', () => {
  it('prefers a service whose name contains the category label', () => {
    expect(matchServiceForCategory(services, 'PORTRAIT', 'Portret')?.id).toBe('portrait');
    expect(matchServiceForCategory(services, 'MURAL', 'Muurschildering')?.id).toBe('mural');
    expect(matchServiceForCategory(services, 'PAINTING', 'Schilderij')?.id).toBe('canvas');
  });

  it('falls back to the first wall service for wall work and the first other service for paintings', () => {
    expect(matchServiceForCategory(services, 'WALL_PAINTING', 'Wandafwerking')?.id).toBe('mural');
    expect(matchServiceForCategory(services, 'PAINTING', 'Tableau')?.id).toBe('canvas');
  });

  it('selects nothing for portraits/other without a matching name', () => {
    expect(matchServiceForCategory(services.filter((s) => s.id !== 'portrait'), 'PORTRAIT', 'Portret')).toBeUndefined();
    expect(matchServiceForCategory(services, 'OTHER', 'Andere')).toBeUndefined();
  });
});

import type { PortfolioCategory, ServiceDto } from '@painter/shared';

const WALL_CATEGORIES: PortfolioCategory[] = ['MURAL', 'WALL_PAINTING'];

/**
 * Service to preselect for a catalog item (FRONTEND_DESIGN.md §4). Services have no category,
 * so the localized category label is looked up in the service names first
 * (e.g. "Portret" → "Portret"); otherwise mural/wall painting → the first wall service and
 * painting → the first non-wall service. Portraits and "other" without a name match → none.
 */
export function matchServiceForCategory(
  services: ServiceDto[],
  category: PortfolioCategory,
  categoryLabel: string,
): ServiceDto | undefined {
  const isWall = WALL_CATEGORIES.includes(category);
  const label = categoryLabel.trim().toLocaleLowerCase();
  const candidates = services.filter((s) => (category === 'OTHER' ? true : s.isWallService === isWall));
  const byName = candidates.find((s) => label.length > 2 && s.name.toLocaleLowerCase().includes(label));
  if (byName) return byName;
  if (isWall) return candidates[0];
  if (category === 'PAINTING') return candidates[0];
  return undefined;
}

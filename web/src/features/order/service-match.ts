import type { CategoryDto, ServiceDto } from '@painter/shared';

/** The starting catalog categories and the starting service that fits each (by their stable slugs). */
const SERVICE_FOR_CATEGORY: Record<string, string> = {
  horeca: 'mural',
  gym: 'mural',
  shops: 'mural',
  home: 'mural',
  'street-art': 'shutter-window',
  'canvas-portrait': 'canvas-painting',
};

/**
 * Service to preselect for a catalog item (FRONTEND_DESIGN.md §4). Categories the artist adds
 * later, uncategorised works and services that are switched off preselect nothing: the
 * customer chooses.
 */
export function matchServiceForCategory(services: ServiceDto[], category: CategoryDto | null): ServiceDto | undefined {
  const slug = category ? SERVICE_FOR_CATEGORY[category.slug] : undefined;
  return slug ? services.find((s) => s.slug === slug) : undefined;
}

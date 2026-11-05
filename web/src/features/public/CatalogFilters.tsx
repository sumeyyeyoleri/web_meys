import { useTranslation } from 'react-i18next';
import type { CategoryDto } from '@painter/shared';
import { cx } from '../../components/ui/cx';

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-300',
        pressed ? 'border-accent bg-accent text-on-accent' : 'border-border-strong text-text-muted hover:border-text-subtle hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

interface CatalogFiltersProps {
  /** Visible categories with published works only (the artist's list, in their order). */
  categories: CategoryDto[];
  category: string | undefined;
  onCategory: (slug: string | undefined) => void;
}

/** One row of pill chips (aria-pressed): "All", then the categories. Hidden when there are none. */
export function CatalogFilters({ categories, category, onCategory }: CatalogFiltersProps) {
  const { t } = useTranslation('public');
  if (categories.length === 0) return null;
  return (
    <div role="group" aria-label={t('catalog.filterCategory')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <Chip pressed={!category} onClick={() => onCategory(undefined)}>
        {t('catalog.all')}
      </Chip>
      {categories.map((value) => (
        <Chip key={value.id} pressed={category === value.slug} onClick={() => onCategory(category === value.slug ? undefined : value.slug)}>
          {value.name}
        </Chip>
      ))}
    </div>
  );
}

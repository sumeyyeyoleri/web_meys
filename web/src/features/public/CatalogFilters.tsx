import { useTranslation } from 'react-i18next';
import { PORTFOLIO_CATEGORIES, SPACES, type PortfolioCategory, type Space } from '@painter/shared';
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
  category: PortfolioCategory | undefined;
  space: Space | undefined;
  onCategory: (category: PortfolioCategory | undefined) => void;
  onSpace: (space: Space | undefined) => void;
}

/** Two rows of pill chips (aria-pressed): kind of work, then space. */
export function CatalogFilters({ category, space, onCategory, onSpace }: CatalogFiltersProps) {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t('catalog.filterCategory')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip pressed={!category} onClick={() => onCategory(undefined)}>
          {t('catalog.all')}
        </Chip>
        {PORTFOLIO_CATEGORIES.map((value) => (
          <Chip key={value} pressed={category === value} onClick={() => onCategory(category === value ? undefined : value)}>
            {tc(`category.${value}`)}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label={t('catalog.filterSpace')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip pressed={!space} onClick={() => onSpace(undefined)}>
          {t('catalog.allSpaces')}
        </Chip>
        {SPACES.map((value) => (
          <Chip key={value} pressed={space === value} onClick={() => onSpace(space === value ? undefined : value)}>
            {tc(`space.${value}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

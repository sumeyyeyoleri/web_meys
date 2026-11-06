import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';

/** Accessible reordering: "Move up" / "Move down" buttons named after the item. */
export function MoveButtons({ name, first, last, busy, onMove }: { name: string; first: boolean; last: boolean; busy?: boolean; onMove: (direction: 'up' | 'down') => void }) {
  const { t } = useTranslation('admin');
  return (
    <span className="inline-flex gap-1">
      <Button variant="secondary" size="sm" className="px-3" disabled={first || busy} aria-label={t('actions.moveUp', { name })} onClick={() => onMove('up')}>
        <Icon name="arrowUp" size={18} />
      </Button>
      <Button variant="secondary" size="sm" className="px-3" disabled={last || busy} aria-label={t('actions.moveDown', { name })} onClick={() => onMove('down')}>
        <Icon name="arrowDown" size={18} />
      </Button>
    </span>
  );
}

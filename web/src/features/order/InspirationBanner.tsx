import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { Button } from '../../components/ui/Button';
import { ArtworkImage } from '../public/ArtworkImage';

/** "You're starting from <title>…" with the example's thumbnail and a Remove button. */
export function InspirationBanner({
  item,
  serviceMatched,
  onRemove,
}: {
  item: PortfolioItemDto;
  serviceMatched: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation('order');
  return (
    <div role="status" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-accent/60 bg-selected p-4 sm:flex-row sm:items-center">
      <ArtworkImage src={item.imageUrl} alt="" className="aspect-square w-20 shrink-0" eager />
      <p className="flex-1 text-[15px] text-text">
        {serviceMatched ? t('inspiration.banner', { title: item.title }) : t('inspiration.bannerNoService', { title: item.title })}
      </p>
      <Button variant="secondary" size="sm" onClick={onRemove} className="self-start sm:self-center">
        {t('inspiration.remove')}
      </Button>
    </div>
  );
}

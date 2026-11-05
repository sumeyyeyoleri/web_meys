import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { formatDimensions } from '../../lib/format';
import { useLocale } from '../../lib/i18n';

/** Definition list used by the selected-work panel and the catalog lightbox. */
export function WorkDetails({ item }: { item: PortfolioItemDto }) {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const none = t('work.notSpecified');

  const rows: Array<[string, string]> = [
    ...(item.category ? ([[t('work.category'), item.category.name]] as Array<[string, string]>) : []),
    [
      t('work.size'),
      item.width !== null && item.height !== null && item.unit ? formatDimensions(item.width, item.height, item.unit, locale) : none,
    ],
    ...(item.year ? ([[t('work.year'), String(item.year)]] as Array<[string, string]>) : []),
    [t('work.price'), tc('labels.personalQuote')],
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 border-t border-border pt-5 text-[15px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-text-subtle">{label}</dt>
          <dd className="text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

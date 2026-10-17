import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto, ServiceDto } from '@painter/shared';
import { Icon } from '../../components/ui/Icon';
import { ArtworkImage } from '../public/ArtworkImage';
import { useSummaryFormat } from './summary-format';
import type { WizardFile, WizardValues } from './wizard-model';

interface SummaryProps {
  values: WizardValues;
  files: WizardFile[];
  services: ServiceDto[] | undefined;
  inspiration: PortfolioItemDto | null;
}

function SummaryList({ values, files, services, inspiration }: SummaryProps) {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  const format = useSummaryFormat();
  const notSet = <span className="text-text-subtle">{t('summary.notSet')}</span>;
  const rows: Array<[string, React.ReactNode]> = [
    [t('summary.service'), format.service(values.service, services) ?? notSet],
    [t('summary.references'), t('summary.referencesCount', { count: files.length + (inspiration ? 1 : 0) })],
    [t('summary.dimensions'), format.dimensions(values.dimensions) ?? notSet],
    [t('summary.budget'), format.budget(values.details) ?? notSet],
    [t('summary.deadline'), format.deadline(values.details) ?? notSet],
    [t('summary.price'), tc('labels.personalQuote')],
  ];
  return (
    <div className="flex flex-col gap-5">
      {inspiration ? (
        <div className="flex items-center gap-3">
          <ArtworkImage src={inspiration.imageUrl} alt="" className="size-14 shrink-0" />
          <div className="min-w-0">
            <p className="eyebrow">{t('summary.inspiration')}</p>
            <p className="truncate font-display text-xl">{inspiration.title}</p>
          </div>
        </div>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-text-subtle">{label}</dt>
            <dd className="text-right text-text">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border pt-4 text-sm text-text-muted">{t('summary.noCharge')}</p>
    </div>
  );
}

/** Sticky panel on desktop; collapsible bar fixed to the bottom on phones (above the home bar). */
export function SummaryPanel(props: SummaryProps) {
  const { t } = useTranslation('order');
  return (
    <>
      <aside aria-labelledby="summary-title" className="sticky top-32 hidden rounded-[var(--radius-panel)] border border-border bg-surface p-6 lg:block">
        <h2 id="summary-title" className="mb-5 text-3xl">
          {t('summary.title')}
        </h2>
        <SummaryList {...props} />
      </aside>
      <details className="group fixed inset-x-0 bottom-0 z-30 border-t border-border-strong bg-surface-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgb(0_0_0/0.6)] lg:hidden">
        <summary className="safe-x flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
          {t('summary.toggle')}
          <Icon name="chevronDown" className="rotate-180 transition-transform group-open:rotate-0" />
        </summary>
        <div className="safe-x max-h-[60vh] overflow-y-auto pb-5">
          <SummaryList {...props} />
        </div>
      </details>
    </>
  );
}

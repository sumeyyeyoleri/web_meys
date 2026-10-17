import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { STEPS, type StepKey } from './wizard-model';

interface WizardHeaderProps {
  businessName: string;
  current: number;
  /** Highest step reached; earlier steps can be revisited from the indicator. */
  reached: number;
  onJump: (step: StepKey) => void;
}

/** "Back to catalog" · business name · "Step X / 6", then 6 equal segments (active = accent). */
export function WizardHeader({ businessName, current, reached, onJump }: WizardHeaderProps) {
  const { t } = useTranslation('order');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link to="/catalog" className="inline-flex min-h-11 items-center gap-2 text-text-muted hover:text-text">
          <Icon name="arrowLeft" size={18} />
          {t('header.backToCatalog')}
        </Link>
        <span className="hidden font-display text-xl sm:block">{businessName}</span>
        <span className="eyebrow" aria-hidden="true">
          {t('header.step', { current: current + 1, total: STEPS.length })}
        </span>
      </div>
      <nav aria-label={t('header.progress')}>
        <ol className="grid grid-cols-6 gap-2">
          {STEPS.map((step, index) => {
            const done = index < current;
            const active = index === current;
            const reachable = index <= reached && !active;
            const label = `${index + 1}. ${t(`steps.${step}`)}`;
            const content = (
              <>
                <span className={cx('block h-0.5 w-full rounded-full', active || done ? 'bg-accent' : 'bg-border-strong')} aria-hidden="true" />
                <span className={cx('mt-2 hidden text-xs font-semibold md:block', active ? 'text-text' : 'text-text-subtle')}>{label}</span>
                <span className="sr-only md:hidden">{label}</span>
                {done ? <span className="sr-only"> ({t('header.completed')})</span> : null}
              </>
            );
            return (
              <li key={step} aria-current={active ? 'step' : undefined}>
                {reachable ? (
                  <button type="button" onClick={() => onJump(step)} className="block min-h-11 w-full text-left">
                    {content}
                  </button>
                ) : (
                  <div className="min-h-11">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

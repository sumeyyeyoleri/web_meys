import { useTranslation } from 'react-i18next';
import { toOptionalNumber, type DimensionsStepInput, type DetailsStepInput, type ServiceDto } from '@painter/shared';
import { formatCalendarDate, formatCurrency, formatDimensions } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import type { ServiceValues } from './wizard-model';

const num = (value: unknown): number | undefined => {
  const parsed = toOptionalNumber(value);
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
};

/** Human-readable values for the summary panel and the review step (raw form values in). */
export function useSummaryFormat() {
  const { t } = useTranslation('order');
  const locale = useLocale();
  return {
    service(values: ServiceValues, services: ServiceDto[] | undefined): string | undefined {
      const service = services?.find((s) => s.id === values.serviceId);
      if (service) return service.name;
      return values.customRequest?.trim() ? t('summary.custom') : undefined;
    },
    dimensions(values: DimensionsStepInput): string | undefined {
      const width = num(values.width);
      const height = num(values.height);
      if (width === undefined || height === undefined) return undefined;
      return formatDimensions(width, height, values.unit === 'M' ? 'M' : 'CM', locale);
    },
    wall(values: DimensionsStepInput): string | undefined {
      const width = num(values.wallWidth);
      const height = num(values.wallHeight);
      if (width === undefined || height === undefined) return undefined;
      return formatDimensions(width, height, values.unit === 'M' ? 'M' : 'CM', locale);
    },
    budget(values: DetailsStepInput): string | undefined {
      const min = num(values.budgetMin);
      const max = num(values.budgetMax);
      if (min !== undefined && max !== undefined) return `${formatCurrency(min, locale)} – ${formatCurrency(max, locale)}`;
      if (min !== undefined) return t('summary.budgetFrom', { min: formatCurrency(min, locale) });
      if (max !== undefined) return t('summary.budgetUpTo', { max: formatCurrency(max, locale) });
      return undefined;
    },
    deadline(values: DetailsStepInput): string | undefined {
      return typeof values.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(values.deadline)
        ? formatCalendarDate(values.deadline, locale)
        : undefined;
    },
  };
}

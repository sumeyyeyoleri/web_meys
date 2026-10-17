import { useTranslation } from 'react-i18next';
import { IconButton } from './Button';
import { Icon } from './Icon';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t('pagination.label')} className="flex items-center justify-center gap-3">
      <IconButton
        label={t('pagination.previous')}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="border border-border-strong"
      >
        <Icon name="chevronLeft" />
      </IconButton>
      <p className="min-w-32 text-center text-sm text-text-muted" aria-live="polite">
        {t('pagination.status', { page, total: totalPages })}
      </p>
      <IconButton
        label={t('pagination.next')}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="border border-border-strong"
      >
        <Icon name="chevronRight" />
      </IconButton>
    </nav>
  );
}

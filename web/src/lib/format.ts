import type { DimensionUnit, Locale } from '@painter/shared';

/** Dates, numbers and money are always formatted with Intl in the active language. */

export function formatDate(value: string | Date, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** Calendar date `YYYY-MM-DD` without time-zone shifting. */
export function formatCalendarDate(value: string, locale: Locale): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatRelativeTime(value: string | Date, locale: Locale, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function formatCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

export function formatFileSize(bytes: number, locale: Locale): string {
  const units = ['byte', 'kilobyte', 'megabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, { style: 'unit', unit: units[unit], unitDisplay: 'short', maximumFractionDigits: 1 }).format(value);
}

export function formatDimensions(width: number, height: number, unit: DimensionUnit, locale: Locale): string {
  const u = unit === 'CM' ? 'centimeter' : 'meter';
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const unitLabel = new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' })
    .formatToParts(1)
    .find((p) => p.type === 'unit')?.value;
  return `${fmt.format(width)} × ${fmt.format(height)} ${unitLabel ?? unit.toLowerCase()}`;
}

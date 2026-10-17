import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatCurrency, formatDimensions } from './format';

describe('Intl formatting follows the active language', () => {
  it('formats money in EUR per locale', () => {
    expect(formatCurrency(1250.5, 'nl-BE')).toMatch(/€\s?1\.250,50/);
    expect(formatCurrency(1250.5, 'en')).toBe('€1,250.50');
    expect(formatCurrency(1250.5, 'tr')).toMatch(/€1\.250,50/);
  });

  it('formats calendar dates without shifting the day', () => {
    expect(formatCalendarDate('2027-04-30', 'en')).toBe('Apr 30, 2027');
    expect(formatCalendarDate('2027-04-30', 'nl-BE')).toMatch(/30 apr/);
  });

  it('formats dimensions with localized decimals', () => {
    expect(formatDimensions(2.5, 3, 'M', 'nl-BE')).toBe('2,5 × 3 m');
    expect(formatDimensions(60, 40, 'CM', 'en')).toBe('60 × 40 cm');
  });
});

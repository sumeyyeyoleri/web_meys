import { DEFAULT_ACCENT_COLOR, HEX_COLOR_PATTERN } from '@painter/shared';

const DARK_TEXT = '#0A0A0A';
const LIGHT_TEXT = '#FFFFFF';
const MIN_CONTRAST = 4.5;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour for the accent: near-black unless that fails 4.5:1, then white. */
export function onAccentColor(accent: string): string {
  return contrastRatio(accent, DARK_TEXT) >= MIN_CONTRAST ? DARK_TEXT : LIGHT_TEXT;
}

/** Applies the admin-configured accent as CSS variables on <html>. */
export function applyAccent(accent: string | null | undefined, root: HTMLElement = document.documentElement) {
  const color = accent && HEX_COLOR_PATTERN.test(accent) ? accent : DEFAULT_ACCENT_COLOR;
  root.style.setProperty('--color-accent', color);
  root.style.setProperty('--color-on-accent', onAccentColor(color));
}

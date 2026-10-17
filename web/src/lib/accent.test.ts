import { describe, expect, it } from 'vitest';
import { applyAccent, contrastRatio, onAccentColor } from './accent';

describe('accent colour', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#E8D3A8', '#0A0A0A')).toBeGreaterThan(12);
    expect(contrastRatio('#A3A3A3', '#050505')).toBeGreaterThan(4.5);
    expect(contrastRatio('#8A8A8A', '#050505')).toBeGreaterThan(4.5);
  });

  it('uses dark text on light accents and white text on dark accents', () => {
    expect(onAccentColor('#E8D3A8')).toBe('#0A0A0A');
    // Terracotta only reaches 3.96:1 with near-black text, so it switches to white (5.0:1).
    expect(contrastRatio('#B4532A', '#0A0A0A')).toBeLessThan(4.5);
    expect(onAccentColor('#B4532A')).toBe('#FFFFFF');
    expect(onAccentColor('#1F3A5F')).toBe('#FFFFFF');
    expect(onAccentColor('#7A1F1F')).toBe('#FFFFFF');
  });

  it('applies the accent to <html> and falls back to the default for invalid values', () => {
    const root = document.createElement('div');
    applyAccent('#1F3A5F', root);
    expect(root.style.getPropertyValue('--color-accent')).toBe('#1F3A5F');
    expect(root.style.getPropertyValue('--color-on-accent')).toBe('#FFFFFF');
    applyAccent('javascript:alert(1)', root);
    expect(root.style.getPropertyValue('--color-accent')).toBe('#E8D3A8');
  });
});

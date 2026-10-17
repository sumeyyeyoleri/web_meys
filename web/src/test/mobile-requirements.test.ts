import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { controlClasses } from '../components/ui/Field';

/** Guards for PROMPT.md §17 (phones and tablets). */
describe('mobile requirements', () => {
  const root = path.resolve(__dirname, '../..');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = readFileSync(path.join(root, 'src/styles.css'), 'utf8');

  it('lets the layout use the full screen and resize with the on-screen keyboard', () => {
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).toContain('interactive-widget=resizes-content');
    // Zooming must stay possible for accessibility.
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
  });

  it('uses at least 16px text in form controls so iPhone Safari does not zoom in', () => {
    expect(controlClasses).toContain('text-base');
    expect(controlClasses).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it('keeps focused fields clear of the fixed navigation and the home bar', () => {
    expect(css).toMatch(/scroll-padding-top:\s*calc\(112px \+ env\(safe-area-inset-top\)\)/);
    expect(css).toMatch(/scroll-margin-top:\s*calc\(112px \+ env\(safe-area-inset-top\)\)/);
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});

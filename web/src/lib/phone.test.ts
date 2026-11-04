import { describe, expect, it } from 'vitest';
import { telHref, whatsappHref } from './phone';

describe('phone links', () => {
  it('builds tel: links without spaces', () => {
    expect(telHref('+32 470 12 34 56')).toBe('tel:+32470123456');
    expect(telHref('0470/12.34.56')).toBe('tel:0470123456');
  });

  it('builds wa.me links with the international number as digits', () => {
    expect(whatsappHref('+32 470 12 34 56')).toBe('https://wa.me/32470123456');
    expect(whatsappHref('+90 (532) 123 45 67')).toBe('https://wa.me/905321234567');
    expect(whatsappHref('0031 6 1234 5678')).toBe('https://wa.me/31612345678');
    // Local numbers are Belgian.
    expect(whatsappHref('0470 12 34 56')).toBe('https://wa.me/32470123456');
    expect(whatsappHref('---')).toBeNull();
  });
});

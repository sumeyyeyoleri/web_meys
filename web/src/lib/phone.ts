/** Country code used for local numbers (0470 …): the business is in Belgium. */
const DEFAULT_COUNTRY_CODE = '32';

/** `tel:` link: the number without spaces or punctuation (keeps a leading +). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * wa.me link: international number as digits only. `+32 …` and `0032 …` keep their country code;
 * a local number starting with 0 is taken as Belgian. Null when there are no digits.
 */
export function whatsappHref(phone: string): string | null {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  }
  return `https://wa.me/${digits}`;
}

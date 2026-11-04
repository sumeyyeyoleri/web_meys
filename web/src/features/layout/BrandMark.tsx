import { cx } from '../../components/ui/cx';
import { useSite } from '../public/hooks';

/**
 * Splits a camel-case name for the wordmark: "MeysArt" → ["Meys", "Art"].
 * Names without such a boundary ("Atelier Noor") are shown in one piece.
 */
export function splitWordmark(name: string): [string, string] | null {
  const match = /^(.*\p{Ll})(\p{Lu}\p{Ll}*)$/u.exec(name.trim());
  return match ? [match[1]!, match[2]!] : null;
}

interface BrandMarkProps {
  /** Text size etc. for the wordmark. */
  className?: string;
  /** Size of the uploaded logo image (it replaces the wordmark). */
  logoClassName?: string;
}

/**
 * The site's brand (PROMPT.md §18.1): the uploaded logo, or the business name as a
 * Cormorant Garamond wordmark with the last word in italic accent colour.
 */
export function BrandMark({ className, logoClassName = 'h-8 w-auto max-w-[180px]' }: BrandMarkProps) {
  const { data: site } = useSite();
  const settings = site?.settings;
  if (!settings) return null;

  if (settings.logoUrl) {
    return <img src={settings.logoUrl} alt={settings.businessName} className={cx('object-contain', logoClassName)} />;
  }

  const parts = splitWordmark(settings.businessName);
  return (
    <span className={cx('font-display leading-none text-text', className)}>
      {parts ? (
        <>
          {parts[0]}
          <em className="text-accent">{parts[1]}</em>
        </>
      ) : (
        settings.businessName
      )}
    </span>
  );
}

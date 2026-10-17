import { useEffect } from 'react';
import { useSite } from '../features/public/hooks';

/** Sets `<title>` to "Page · Business name". */
export function usePageTitle(title: string | undefined) {
  const { data: site } = useSite();
  const businessName = site?.settings.businessName;
  useEffect(() => {
    const parts = [title, businessName].filter(Boolean);
    if (parts.length) document.title = parts.join(' · ');
  }, [title, businessName]);
}

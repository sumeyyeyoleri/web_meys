/** Public navigation (labels are keys in the `common` namespace). */
export const NAV_LINKS = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/catalog', labelKey: 'nav.catalog', end: false },
  { to: '/services', labelKey: 'nav.services', end: false },
  { to: '/contact', labelKey: 'nav.contact', end: false },
] as const;

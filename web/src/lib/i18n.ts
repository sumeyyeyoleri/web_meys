import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  ORDER_DESCRIPTION_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILES,
  type Locale,
} from '@painter/shared';
import enAccount from '../locales/en/account.json';
import enAdmin from '../locales/en/admin.json';
import enCommon from '../locales/en/common.json';
import enOrder from '../locales/en/order.json';
import enPublic from '../locales/en/public.json';
import enValidation from '../locales/en/validation.json';
import nlAccount from '../locales/nl-BE/account.json';
import nlAdmin from '../locales/nl-BE/admin.json';
import nlCommon from '../locales/nl-BE/common.json';
import nlOrder from '../locales/nl-BE/order.json';
import nlPublic from '../locales/nl-BE/public.json';
import nlValidation from '../locales/nl-BE/validation.json';
import trAccount from '../locales/tr/account.json';
import trAdmin from '../locales/tr/admin.json';
import trCommon from '../locales/tr/common.json';
import trOrder from '../locales/tr/order.json';
import trPublic from '../locales/tr/public.json';
import trValidation from '../locales/tr/validation.json';

export const NAMESPACES = ['common', 'public', 'order', 'account', 'admin', 'validation'] as const;

export const resources = {
  'nl-BE': { common: nlCommon, public: nlPublic, order: nlOrder, account: nlAccount, admin: nlAdmin, validation: nlValidation },
  en: { common: enCommon, public: enPublic, order: enOrder, account: enAccount, admin: enAdmin, validation: enValidation },
  tr: { common: trCommon, public: trPublic, order: trOrder, account: trAccount, admin: trAdmin, validation: trValidation },
} satisfies Record<Locale, Record<(typeof NAMESPACES)[number], unknown>>;

const STORAGE_KEY = 'painter.locale';

/** The visitor's saved language; storage can be unavailable (private mode), so this never throws. */
export function getStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage blocked — fall back to the default.
  }
  return DEFAULT_LOCALE;
}

function storeLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  load: 'currentOnly',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

function syncDocumentLanguage(locale: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

/** Switches the UI language, persists it and updates `<html lang>`. */
export async function setLocale(locale: Locale) {
  storeLocale(locale);
  await i18n.changeLanguage(locale);
}

export function useLocale(): Locale {
  const { i18n: instance } = useTranslation();
  return isLocale(instance.language) ? instance.language : DEFAULT_LOCALE;
}

/** Values interpolated into validation messages, from the shared constants. */
export const VALIDATION_PARAMS = {
  min: PASSWORD_MIN_LENGTH,
  minDescription: ORDER_DESCRIPTION_MIN_LENGTH,
  maxFiles: UPLOAD_MAX_FILES,
  maxSizeMb: Math.round(UPLOAD_MAX_FILE_SIZE_BYTES / (1024 * 1024)),
};

/** Translates an API/Zod validation key such as `validation.required`. */
export function useValidationMessage() {
  const { t } = useTranslation('validation');
  return (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const bare = key.startsWith('validation.') ? key.slice('validation.'.length) : key;
    return t(bare, { ...VALIDATION_PARAMS, defaultValue: t('invalid') });
  };
}

export default i18n;

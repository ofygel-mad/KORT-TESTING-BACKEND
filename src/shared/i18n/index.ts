import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ru, type TKeys } from './ru';
import { kk } from './kk';

const LOCALES = { ru, kk } as const;
type Locale = keyof typeof LOCALES;

interface I18nStore {
  locale: Locale;
  t: TKeys;
  setLocale: (l: Locale) => void;
}

export const useI18n = create<I18nStore>()(
  persist(
    (set) => ({
      locale: 'ru',
      t: ru,
      setLocale: (locale) => set({ locale, t: LOCALES[locale] }),
    }),
    { name: 'kort-locale' },
  ),
);

export const useT = () => useI18n((s) => ({ t: s.t, locale: s.locale, setLocale: s.setLocale }));

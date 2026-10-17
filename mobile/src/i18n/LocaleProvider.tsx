import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, LOCALES, Locale, getLocale, setLocale as setGlobalLocale } from './index';

const KEY = 'school17_locale';

interface Ctx {
  locale: Locale;
  ready: boolean;
  /** Switches the language everywhere at once (the whole tree re-renders) and remembers it on this device. */
  setLanguage: (l: Locale) => Promise<void>;
  /** Uses the language saved on the account, but only when this device has no language chosen yet. */
  adoptServerLocale: (l: string | undefined) => void;
}
const LocaleContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, ready: false, setLanguage: async () => undefined, adoptServerLocale: () => undefined });
export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLoc] = useState<Locale>(getLocale());
  const [ready, setReady] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && (LOCALES as string[]).includes(saved)) {
          setGlobalLocale(saved as Locale);
          setLoc(saved as Locale);
          setHasSaved(true);
        }
      } catch {
        /* storage unavailable: keep the default */
      }
      setReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (l: Locale) => {
    setGlobalLocale(l);
    setLoc(l);
    setHasSaved(true);
    try {
      await AsyncStorage.setItem(KEY, l);
    } catch {
      /* not remembered, still applied for this session */
    }
  }, []);

  const adoptServerLocale = useCallback((l: string | undefined) => {
    if (hasSaved || !l || !(LOCALES as string[]).includes(l) || l === getLocale()) return;
    setGlobalLocale(l as Locale);
    setLoc(l as Locale);
  }, [hasSaved]);

  // `key` remounts the tree so every screen picks up the new language.
  return (
    <LocaleContext.Provider value={{ locale, ready, setLanguage, adoptServerLocale }}>
      <React.Fragment key={locale}>{children}</React.Fragment>
    </LocaleContext.Provider>
  );
}

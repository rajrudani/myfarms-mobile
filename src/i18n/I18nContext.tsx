import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { storage } from '../utils/storage';
import { setApiLocale } from '../api/client';
import { authApi } from '../api/auth';

import enDictionary from './locales/en.json';
import guDictionary from './locales/gu.json';
import hiDictionary from './locales/hi.json';

export type SupportedLocale = 'en' | 'gu' | 'hi';

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

const dictionaries: Record<SupportedLocale, Record<string, string>> = {
  en: enDictionary as Record<string, string>,
  gu: guDictionary as Record<string, string>,
  hi: hiDictionary as Record<string, string>,
};

// Global active locale state for helper functions
let activeLocale: SupportedLocale = 'en';

/**
 * Core translation lookup with variable substitution and fallback
 */
export function translate(
  key: string,
  params?: Record<string, string | number>,
  locale: SupportedLocale = activeLocale
): string {
  if (!key) return '';

  const dict = dictionaries[locale] || dictionaries.en;
  let translated = dict[key];

  // Fallback to English if missing or empty in target locale
  if (!translated || translated.trim() === '') {
    translated = dictionaries.en[key] || key;
  }

  // Replace variable placeholders like :name, %{name}, or {name}
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      const valStr = String(paramVal);
      translated = translated
        .replace(new RegExp(`:${paramKey}\\b`, 'g'), valStr)
        .replace(new RegExp(`%\\{${paramKey}\\}`, 'g'), valStr)
        .replace(new RegExp(`\\{${paramKey}\\}`, 'g'), valStr);
    });
  }

  return translated;
}

export const t = translate;

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (newLocale: SupportedLocale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: LocaleOption[];
  isLoaded: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadLocale() {
      try {
        const storedLocale = await storage.getLocale();
        if (storedLocale && (storedLocale === 'en' || storedLocale === 'gu' || storedLocale === 'hi')) {
          setLocaleState(storedLocale);
          activeLocale = storedLocale;
          setApiLocale(storedLocale);
        } else {
          // Check if user has preferred_locale saved in profile
          const user = await storage.getUser();
          const userPref = user?.preferred_locale;
          if (userPref && (userPref === 'en' || userPref === 'gu' || userPref === 'hi')) {
            setLocaleState(userPref);
            activeLocale = userPref;
            setApiLocale(userPref);
            await storage.setLocale(userPref);
          } else {
            activeLocale = 'en';
            setApiLocale('en');
          }
        }
      } catch (err) {
        console.warn('Failed to load locale:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    loadLocale();
  }, []);

  const changeLocale = useCallback(async (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    activeLocale = newLocale;
    setApiLocale(newLocale);
    await storage.setLocale(newLocale);

    // Sync preference with backend profile if authenticated
    try {
      const user = await storage.getUser();
      if (user) {
        user.preferred_locale = newLocale;
        await storage.setUser(user);
        await authApi.updateProfile({
          name: user.name,
          preferred_locale: newLocale,
        });
      }
    } catch {
      // Non-critical background sync
    }
  }, []);

  const translateWithCurrentLocale = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(key, params, locale);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale: changeLocale,
      t: translateWithCurrentLocale,
      locales: SUPPORTED_LOCALES,
      isLoaded,
    }),
    [locale, changeLocale, translateWithCurrentLocale, isLoaded]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

export const useI18n = useTranslation;

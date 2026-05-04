"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  getMessages,
  type Locale,
  type Messages,
  type Theme,
  LOCALES,
  STORAGE_LOCALE,
  STORAGE_THEME,
  isLocale,
  isTheme,
} from "@/lib/i18n";

type AppSettings = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  messages: Messages;
};

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pl");
  const [theme, setThemeState] = useState<Theme>("light");

  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const storedL = localStorage.getItem(STORAGE_LOCALE);
        if (isLocale(storedL)) {
          setLocaleState(storedL);
        }
        const storedT = localStorage.getItem(STORAGE_THEME);
        if (isTheme(storedT)) {
          setThemeState(storedT);
        }
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_LOCALE, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "dark" ? "dark" : "light",
    );
    try {
      localStorage.setItem(STORAGE_THEME, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      theme,
      setTheme,
      toggleTheme,
      messages,
    }),
    [locale, setLocale, theme, setTheme, toggleTheme, messages],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppProviders");
  }
  return ctx;
}

export { LOCALES };
export type { Locale };

import type { Locale, Messages } from "./types";
import { en } from "./en";
import { pl } from "./pl";
import { de } from "./de";
import { fr } from "./fr";

export type { Locale, Messages } from "./types";
export { LOCALES } from "./types";

const catalogs: Record<Locale, Messages> = { en, pl, de, fr };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? en;
}

export function isLocale(value: string | null): value is Locale {
  return (
    value !== null &&
    (value === "en" || value === "pl" || value === "de" || value === "fr")
  );
}

export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

export const STORAGE_LOCALE = "inpost-locale";
export const STORAGE_THEME = "inpost-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null): value is Theme {
  return value !== null && (value === "light" || value === "dark");
}

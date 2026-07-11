import { de, enUS, fr, type Locale } from "date-fns/locale";

const dateFnsLocales: Record<string, Locale> = { de, en: enUS, fr };

export function getDateFnsLocale(locale: string): Locale {
  return dateFnsLocales[locale] ?? fr;
}

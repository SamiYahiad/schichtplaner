/**
 * Response-language directive for Claude prompts.
 *
 * AI features that generate free-form text (briefings, forecasts, shift
 * suggestion reasons) must produce that text in the app's active locale,
 * not a hardcoded language. Since the generated text isn't routed through
 * next-intl messages, we instead tell Claude which language to answer in.
 */

import { getLocale } from "next-intl/server";

const RESPONSE_LANGUAGE_DIRECTIVE: Record<string, string> = {
  de: "Antworte auf Deutsch.",
  en: "Respond in English.",
  fr: "Réponds en français.",
};

/** Get the "respond in language X" directive for the current request locale. */
export async function getResponseLanguageDirective(): Promise<string> {
  const locale = await getLocale();
  return RESPONSE_LANGUAGE_DIRECTIVE[locale] ?? RESPONSE_LANGUAGE_DIRECTIVE.de;
}

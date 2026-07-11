"use server";

import { cookies } from "next/headers";
import { routing } from "./routing";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_MAX_AGE } from "./locale-cookie";

export async function setLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
}

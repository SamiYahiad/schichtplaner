import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { LOCALE_COOKIE_NAME } from "./locale-cookie";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale =
    cookieLocale && routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
      ? cookieLocale
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "de", "en"],
  defaultLocale: "fr",
});

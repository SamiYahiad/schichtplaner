"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/i18n/set-locale";
import { routing } from "@/i18n/routing";

const localeLabels: Record<string, string> = {
  fr: "Français",
  de: "Deutsch",
  en: "English",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  async function handleSelect(next: string) {
    if (next === locale) return;
    await setLocale(next);
    router.refresh();
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="mr-2 size-4" />
        {localeLabels[locale] ?? locale}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {routing.locales.map((code) => (
          <DropdownMenuItem key={code} onClick={() => handleSelect(code)}>
            {localeLabels[code] ?? code}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

"use client";

import { useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  FileHeart,
  Users,
  Umbrella,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTION_DEFS = [
  {
    key: "schedule",
    labelKey: "settings.schedule",
    icon: Calendar,
  },
  {
    key: "time",
    labelKey: "settings.timeTracking",
    icon: Clock,
  },
  {
    key: "wishplan",
    labelKey: "settings.wishPlans",
    icon: FileHeart,
  },
  {
    key: "employees",
    labelKey: "settings.employees",
    icon: Users,
  },
  {
    key: "absences",
    labelKey: "settings.absences",
    icon: Umbrella,
  },
  {
    key: "account",
    labelKey: "settings.account",
    icon: Building2,
  },
] as const;

export type SettingsSection = (typeof SECTION_DEFS)[number]["key"];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const t = useTranslations();
  return (
    <aside className="w-56 shrink-0">
      <nav>
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("settings.title")}
        </h3>
        <ul className="space-y-0.5">
          {SECTION_DEFS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.key;
            return (
              <li key={section.key}>
                <button
                  type="button"
                  onClick={() => onSectionChange(section.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{t(section.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

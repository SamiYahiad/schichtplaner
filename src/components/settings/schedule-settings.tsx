"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleSettingsProps {
  nameFormat: string;
  scheduleVisibility: string;
  onUpdate: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function ScheduleSettings({
  nameFormat,
  scheduleVisibility,
  onUpdate,
  isSaving,
}: ScheduleSettingsProps) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("settings.schedule")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.scheduleDescription")}
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Name format */}
        <div className="space-y-2">
          <Label>{t("settings.nameFormat")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.nameFormatDescription")}
          </p>
          <Select
            value={nameFormat}
            onValueChange={(value) => onUpdate({ nameFormat: value })}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LASTNAME_FIRSTNAME">
                {t("settings.lastNameFirstName")}
              </SelectItem>
              <SelectItem value="FIRSTNAME_LASTNAME">
                {t("settings.firstNameLastName")}
              </SelectItem>
              <SelectItem value="LASTNAME">{t("settings.lastNameOnly")}</SelectItem>
              <SelectItem value="FIRSTNAME">{t("settings.firstNameOnly")}</SelectItem>
              <SelectItem value="NICKNAME">{t("settings.nickname")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Schedule visibility */}
        <div className="space-y-2">
          <Label>{t("settings.visibility")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.visibilityDescription")}
          </p>
          <Select
            value={scheduleVisibility}
            onValueChange={(value) =>
              onUpdate({ scheduleVisibility: value })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("settings.allShifts")}</SelectItem>
              <SelectItem value="OWN_ONLY">{t("settings.ownShiftsOnly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
    </div>
  );
}

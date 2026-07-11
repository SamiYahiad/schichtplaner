"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeSettingsData {
  whoCanUse: string;
  watchAutoStop: boolean;
  warningsEnabled: boolean;
  warningsMaxHours: number;
  useCategories: boolean;
}

interface TimeSettingsProps {
  timeSettings: TimeSettingsData;
  onUpdate: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function TimeSettings({
  timeSettings,
  onUpdate,
  isSaving,
}: TimeSettingsProps) {
  const t = useTranslations();
  function handleTimeSettingsChange(partial: Partial<TimeSettingsData>) {
    onUpdate({
      timeSettings: {
        ...partial,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("settings.timeTracking")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.timeTrackingDescription")}
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Who can use */}
        <div className="space-y-2">
          <Label>{t("settings.whoCanTrackTime")}</Label>
          <Select
            value={timeSettings.whoCanUse}
            onValueChange={(value) =>
              handleTimeSettingsChange({ whoCanUse: value })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("schedule.allEmployees")}</SelectItem>
              <SelectItem value="CHOOSE">{t("settings.selectSpecific")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Auto-stop */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.autoStopWatch")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.autoStopWatchDescription")}
            </p>
          </div>
          <Switch
            checked={timeSettings.watchAutoStop}
            onCheckedChange={(checked) =>
              handleTimeSettingsChange({ watchAutoStop: checked })
            }
            disabled={isSaving}
          />
        </div>

        <Separator />

        {/* Warnings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.enableWarnings")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.warningsDescription")}
              </p>
            </div>
            <Switch
              checked={timeSettings.warningsEnabled}
              onCheckedChange={(checked) =>
                handleTimeSettingsChange({ warningsEnabled: checked })
              }
              disabled={isSaving}
            />
          </div>

          {timeSettings.warningsEnabled && (
            <div className="space-y-2 ml-1 pl-4 border-l-2 border-muted">
              <Label>{t("settings.maxHoursPerDay")}</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={timeSettings.warningsMaxHours}
                onChange={(e) =>
                  handleTimeSettingsChange({
                    warningsMaxHours: parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-24"
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Categories */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.useCategories")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.useCategoriesDescription")}
            </p>
          </div>
          <Switch
            checked={timeSettings.useCategories}
            onCheckedChange={(checked) =>
              handleTimeSettingsChange({ useCategories: checked })
            }
            disabled={isSaving}
          />
        </div>
      </Card>
    </div>
  );
}

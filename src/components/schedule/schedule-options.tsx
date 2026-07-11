"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  EyeOff,
  Filter,
  Settings2,
  FileText,
  Layout,
  Type,
  Pause,
  Download,
  Loader2,
  Trash2,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ScheduleData, ScheduleLayout, BriefingData, DivisionOption } from "@/types/schedule";

interface ScheduleOptionsProps {
  schedule: ScheduleData;
  isManager: boolean;
  divisionFilter: string | null;
  onDivisionFilterChange: (divisionId: string | null) => void;
}

export function ScheduleOptions({
  schedule,
  isManager,
  divisionFilter,
  onDivisionFilterChange,
}: ScheduleOptionsProps) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sichtbarkeit */}
      {isManager && (
        <VisibilityToggle
          scheduleId={schedule.id}
          isPublic={schedule.isPublic}
        />
      )}

      {/* Non-manager visibility badge (read-only) */}
      {!isManager && (
        <Badge variant={schedule.isPublic ? "default" : "secondary"} className="gap-1.5">
          {schedule.isPublic ? (
            <>
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
              {t("schedule.published")}
            </>
          ) : (
            <>
              <EyeOff className="size-3" />
              {t("schedule.hidden")}
            </>
          )}
        </Badge>
      )}

      {/* Bereich filter */}
      <DivisionFilter
        scheduleId={schedule.id}
        divisionFilter={divisionFilter}
        onDivisionFilterChange={onDivisionFilterChange}
      />

      {/* Optionen */}
      {isManager && (
        <OptionsMenu
          scheduleId={schedule.id}
          settingsLayout={schedule.settingsLayout}
          showTitle={schedule.showTitle}
          showPauses={schedule.showPauses}
        />
      )}

      {/* Briefing */}
      <BriefingButton
        scheduleId={schedule.id}
        isManager={isManager}
      />

      {/* KI-Briefing */}
      {isManager && (
        <AiBriefingButton scheduleId={schedule.id} />
      )}
    </div>
  );
}

// ─── Visibility Toggle ─────────────────────────────────────────────

function VisibilityToggle({
  scheduleId,
  isPublic,
}: {
  scheduleId: string;
  isPublic: boolean;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newValue }),
      });
      if (!res.ok) throw new Error(t("common.errorUpdating"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: () => {
      toast.error(t("schedule.errorChangingVisibility"));
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {isPublic ? (
            <>
              <span className="size-1.5 rounded-full bg-green-500" />
              {t("schedule.published")}
            </>
          ) : (
            <>
              <EyeOff className="size-3.5" />
              {t("schedule.hidden")}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("schedule.visibility")}</p>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? t("schedule.visibilityPublicHint")
                : t("schedule.visibilityPrivateHint")}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="visibility-switch" className="text-sm">
              {isPublic ? t("schedule.publicLabel") : t("schedule.privateLabel")}
            </Label>
            <Switch
              id="visibility-switch"
              checked={isPublic}
              onCheckedChange={(checked) => mutation.mutate(checked)}
              disabled={mutation.isPending}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Division Filter ────────────────────────────────────────────────

function DivisionFilter({
  scheduleId,
  divisionFilter,
  onDivisionFilterChange,
}: {
  scheduleId: string;
  divisionFilter: string | null;
  onDivisionFilterChange: (divisionId: string | null) => void;
}) {
  const t = useTranslations();
  const { data } = useQuery<{ divisions: DivisionOption[] }>({
    queryKey: ["divisions"],
    queryFn: async () => {
      const res = await fetch("/api/divisions");
      if (!res.ok) throw new Error(t("schedule.errorLoadingDivisions"));
      return res.json();
    },
  });

  const divisions = data?.divisions ?? [];
  const selectedDivision = divisions.find((d) => d.id === divisionFilter);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" />
          {selectedDivision ? (
            <>
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: selectedDivision.color }}
              />
              {selectedDivision.title}
            </>
          ) : (
            t("schedule.division")
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("schedule.filterDivision")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDivisionFilterChange(null)}
          className={cn(!divisionFilter && "font-semibold")}
        >
          {t("common.all")}
        </DropdownMenuItem>
        {divisions
          .filter((d) => !("isSystem" in d && d.isSystem))
          .map((division) => (
            <DropdownMenuItem
              key={division.id}
              onClick={() => onDivisionFilterChange(division.id)}
              className={cn(
                "gap-2",
                divisionFilter === division.id && "font-semibold"
              )}
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: division.color }}
              />
              {division.title}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Options Menu ───────────────────────────────────────────────────

function OptionsMenu({
  scheduleId,
  settingsLayout,
  showTitle,
  showPauses,
}: {
  scheduleId: string;
  settingsLayout: ScheduleLayout;
  showTitle: boolean;
  showPauses: boolean;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t("common.errorUpdating"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: () => {
      toast.error(t("common.errorSaving"));
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-3.5" />
          {t("schedule.options")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("schedule.display")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Layout Toggle */}
        <DropdownMenuCheckboxItem
          checked={settingsLayout === "LAYOUT_1"}
          onCheckedChange={() =>
            mutation.mutate({ settingsLayout: "LAYOUT_1" })
          }
        >
          <Layout className="size-3.5" />
          {t("schedule.layout1")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settingsLayout === "LAYOUT_2"}
          onCheckedChange={() =>
            mutation.mutate({ settingsLayout: "LAYOUT_2" })
          }
        >
          <Layout className="size-3.5" />
          {t("schedule.layout2")}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Show/hide titles */}
        <DropdownMenuCheckboxItem
          checked={showTitle}
          onCheckedChange={(checked) =>
            mutation.mutate({ showTitle: checked })
          }
        >
          <Type className="size-3.5" />
          {t("schedule.showTitles")}
        </DropdownMenuCheckboxItem>

        {/* Show/hide pauses */}
        <DropdownMenuCheckboxItem
          checked={showPauses}
          onCheckedChange={(checked) =>
            mutation.mutate({ showPauses: checked })
          }
        >
          <Pause className="size-3.5" />
          {t("schedule.showPausesOption")}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Export submenu placeholder */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="size-3.5" />
            {t("common.export")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem disabled>
              {t("schedule.exportPdfComingSoon")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              {t("schedule.exportExcelComingSoon")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Briefing Button + Sheet ────────────────────────────────────────

function BriefingButton({
  scheduleId,
  isManager,
}: {
  scheduleId: string;
  isManager: boolean;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [initialText, setInitialText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch briefing
  const { data, isLoading } = useQuery<{ briefing: BriefingData | null }>({
    queryKey: ["briefing", scheduleId],
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${scheduleId}/briefing`);
      if (!res.ok) throw new Error(t("common.errorLoading"));
      return res.json();
    },
    enabled: !!scheduleId,
  });

  const briefing = data?.briefing ?? null;
  const hasBriefing = !!briefing;

  // Sync text when sheet opens
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const briefingText = briefing?.text ?? "";
      setText(briefingText);
      setInitialText(briefingText);
    }
  };

  // Auto-resize textarea
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      // Auto-resize
      const el = e.target;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    },
    []
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schedules/${scheduleId}/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.errorSaving"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("schedule.toastBriefingSaved"));
      queryClient.invalidateQueries({ queryKey: ["briefing", scheduleId] });
      setInitialText(text);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schedules/${scheduleId}/briefing`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t("common.errorDeleting"));
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("schedule.toastBriefingDeleted"));
      queryClient.invalidateQueries({ queryKey: ["briefing", scheduleId] });
      setText("");
      setInitialText("");
    },
    onError: () => {
      toast.error(t("schedule.errorDeletingBriefing"));
    },
  });

  const hasChanges = text !== initialText;
  const isPending = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5", hasBriefing && "border-blue-300 text-blue-600")}
        >
          <FileText className="size-3.5" />
          {t("schedule.briefing")}
          {hasBriefing && (
            <span className="size-1.5 rounded-full bg-blue-500" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("schedule.weeklyBriefing")}</SheetTitle>
          <SheetDescription>
            {t("schedule.weeklyBriefingDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : isManager ? (
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder={t("schedule.briefingPlaceholder")}
              className="min-h-[200px] resize-none"
              disabled={isPending}
            />
          ) : briefing ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {briefing.text}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("schedule.noBriefingThisWeek")}
            </p>
          )}
        </div>

        {isManager && (
          <SheetFooter className="flex-row gap-2">
            {hasBriefing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(t("schedule.confirmDeleteBriefing"))) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {t("common.delete")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={isPending || !text.trim() || !hasChanges}
              className="ml-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {t("common.save")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── AI Briefing Button ─────────────────────────────────────────────

function AiBriefingButton({ scheduleId }: { scheduleId: string }) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<{ text: string }> => {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("schedule.errorGenerating"));
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // Save the generated text as the briefing
      const res = await fetch(`/api/schedules/${scheduleId}/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["briefing", scheduleId] });
        toast.success(t("schedule.toastAiBriefingSaved"));
      } else {
        toast.success(t("schedule.toastAiBriefingCreatedManualSave"));
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950"
    >
      {mutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      {t("schedule.aiBriefing")}
    </Button>
  );
}

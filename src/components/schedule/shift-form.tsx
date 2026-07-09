"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ShiftData, DivisionOption } from "@/types/schedule";

interface ShiftFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  /** Pre-selected day of week (1-7) for create mode */
  defaultDayOfWeek?: number;
  /** Shift to edit (if editing) */
  shift?: ShiftData | null;
}

const DAY_CHECKBOXES = [
  { day: 1, key: "mon" },
  { day: 2, key: "tue" },
  { day: 3, key: "wed" },
  { day: 4, key: "thu" },
  { day: 5, key: "fri" },
  { day: 6, key: "sat" },
  { day: 7, key: "sun" },
] as const;

export function ShiftForm({
  open,
  onOpenChange,
  scheduleId,
  defaultDayOfWeek = 1,
  shift,
}: ShiftFormProps) {
  const t = useTranslations();
  const isEdit = !!shift;
  const queryClient = useQueryClient();

  // Form state
  const [shiftFrom, setShiftFrom] = useState("08:00");
  const [shiftTo, setShiftTo] = useState("17:00");
  const [divisionId, setDivisionId] = useState<string>("none");
  const [maxEmployees, setMaxEmployees] = useState(1);
  const [title, setTitle] = useState("");
  const [pauseOption, setPauseOption] = useState<"PER_HOUR" | "PER_SHIFT">("PER_HOUR");
  const [pauseValue, setPauseValue] = useState(0);
  const [description, setDescription] = useState("");
  const [repeatDays, setRepeatDays] = useState<number[]>([defaultDayOfWeek]);

  // Fetch divisions for dropdown
  const { data: divisionsData } = useQuery<{ divisions: DivisionOption[] }>({
    queryKey: ["divisions"],
    queryFn: async () => {
      const res = await fetch("/api/divisions");
      if (!res.ok) throw new Error(t("schedule.errorLoadingDivisions"));
      return res.json();
    },
  });

  const divisions = divisionsData?.divisions ?? [];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (shift) {
        // Edit mode: populate from shift
        setShiftFrom(shift.shiftFrom);
        setShiftTo(shift.shiftTo);
        setDivisionId(shift.divisionId ?? "none");
        setMaxEmployees(shift.maxEmployees);
        setTitle(shift.title ?? "");
        setPauseOption(shift.pauseOption);
        setPauseValue(shift.pauseValue);
        setDescription(shift.description ?? "");
        setRepeatDays([shift.dayOfWeek]);
      } else {
        // Create mode: reset to defaults
        setShiftFrom("08:00");
        setShiftTo("17:00");
        setDivisionId("none");
        setMaxEmployees(1);
        setTitle("");
        setPauseOption("PER_HOUR");
        setPauseValue(0);
        setDescription("");
        setRepeatDays([defaultDayOfWeek]);
      }
    }
  }, [open, shift, defaultDayOfWeek]);

  // Toggle a day in repeatDays
  function toggleDay(day: number) {
    setRepeatDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          divisionId: divisionId !== "none" ? divisionId : null,
          dayOfWeek: repeatDays[0] ?? defaultDayOfWeek,
          shiftFrom,
          shiftTo,
          maxEmployees,
          pauseOption,
          pauseValue,
          title: title.trim() || null,
          description: description.trim() || null,
          repeatDays: repeatDays.length > 0 ? repeatDays : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("schedule.errorCreating"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        repeatDays.length > 1
          ? t("schedule.toastShiftsCreated", { count: repeatDays.length })
          : t("schedule.toastShiftCreated")
      );
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!shift) return;
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId: divisionId !== "none" ? divisionId : null,
          dayOfWeek: repeatDays[0] ?? shift.dayOfWeek,
          shiftFrom,
          shiftTo,
          maxEmployees,
          pauseOption,
          pauseValue,
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.errorSaving"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("schedule.toastShiftUpdated"));
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!shift) return;
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.errorDeleting"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("schedule.toastShiftDeleted"));
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (shiftFrom >= shiftTo) {
      toast.error(t("schedule.errorStartBeforeEnd"));
      return;
    }
    if (!isEdit && repeatDays.length === 0) {
      toast.error(t("schedule.errorAtLeastOneDay"));
      return;
    }
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  function handleDelete() {
    if (confirm(t("schedule.confirmDeleteShift"))) {
      deleteMutation.mutate();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t("schedule.editShift") : t("schedule.newShift")}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t("schedule.editShiftDescription")
                : t("schedule.newShiftDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shift-from">{t("schedule.from")}</Label>
                <Input
                  id="shift-from"
                  type="time"
                  value={shiftFrom}
                  onChange={(e) => setShiftFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-to">{t("schedule.to")}</Label>
                <Input
                  id="shift-to"
                  type="time"
                  value={shiftTo}
                  onChange={(e) => setShiftTo(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Division select */}
            <div className="space-y-1.5">
              <Label>{t("schedule.workArea")}</Label>
              <Select
                value={divisionId}
                onValueChange={setDivisionId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("schedule.noWorkArea")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">{t("schedule.noWorkArea")}</span>
                  </SelectItem>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: div.color }}
                        />
                        {div.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max employees */}
            <div className="space-y-1.5">
              <Label htmlFor="max-employees">{t("schedule.maxEmployees")}</Label>
              <Input
                id="max-employees"
                type="number"
                min={1}
                max={100}
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="shift-title">{t("schedule.titleOptional")}</Label>
              <Input
                id="shift-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("schedule.titlePlaceholder")}
                maxLength={100}
              />
            </div>

            {/* Pause options */}
            <div className="space-y-1.5">
              <Label>{t("schedule.pause")}</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={pauseValue}
                  onChange={(e) => setPauseValue(parseInt(e.target.value, 10) || 0)}
                  className="w-20"
                  placeholder={t("schedule.minAbbrev")}
                />
                <span className="text-sm text-muted-foreground">{t("schedule.minutes")}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pauseOption"
                    checked={pauseOption === "PER_HOUR"}
                    onChange={() => setPauseOption("PER_HOUR")}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t("schedule.perHour")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pauseOption"
                    checked={pauseOption === "PER_SHIFT"}
                    onChange={() => setPauseOption("PER_SHIFT")}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t("schedule.perShift")}</span>
                </label>
              </div>
            </div>

            {/* Repeat days - only for CREATE mode */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>{t("schedule.repeatDays")}</Label>
                <div className="flex items-center gap-1.5">
                  {DAY_CHECKBOXES.map(({ day, key }) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "size-9 rounded-md text-xs font-medium transition-colors border",
                        repeatDays.includes(day)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-accent"
                      )}
                    >
                      {t(`schedule.${key}`)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t("schedule.repeatDaysHint")}
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="shift-description">{t("schedule.descriptionOptional")}</Label>
              <Textarea
                id="shift-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("schedule.descriptionPlaceholder")}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <div className="flex w-full items-center justify-between">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {t("common.delete")}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {isEdit ? t("common.save") : t("common.create")}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useCurrentMember } from "@/lib/hooks/use-current-member";

// ---------- Types ----------

type AbsenceCategory = {
  id: string;
  name: string;
  color: string;
  isPaid: boolean;
};

type AbsenceData = {
  id: string;
  userId: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "DECLINED";
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  category: AbsenceCategory;
};

type EmployeeOption = {
  userId: string;
  firstName: string;
  lastName: string;
};

interface AbsenceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence?: AbsenceData | null;
  employees?: EmployeeOption[];
  defaultDateFrom?: string;
  defaultDateTo?: string;
}

// ---------- Helpers ----------

function calculateDays(from: string, to: string): number {
  const dateFrom = new Date(from);
  const dateTo = new Date(to);
  if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) return 0;
  const diffTime = dateTo.getTime() - dateFrom.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function getStatusBadge(status: string, t: ReturnType<typeof useTranslations>) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          {t("employees.statusPending")}
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          {t("employees.statusApproved")}
        </Badge>
      );
    case "DECLINED":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {t("employees.statusDeclined")}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ---------- Component ----------

export function AbsenceForm({
  open,
  onOpenChange,
  absence,
  employees = [],
  defaultDateFrom,
  defaultDateTo,
}: AbsenceFormProps) {
  const isEdit = !!absence;
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const isAdmin =
    currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";

  // Form state
  const [userId, setUserId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState(
    defaultDateFrom || format(new Date(), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(
    defaultDateTo || format(new Date(), "yyyy-MM-dd")
  );
  const [note, setNote] = useState("");

  // Fetch categories
  const { data: categoriesData } = useQuery<{ categories: AbsenceCategory[] }>({
    queryKey: ["absence-categories"],
    queryFn: async () => {
      const res = await fetch("/api/absences/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const categories = categoriesData?.categories ?? [];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (absence) {
        setUserId(absence.userId);
        setCategoryId(absence.categoryId);
        setDateFrom(absence.dateFrom.slice(0, 10));
        setDateTo(absence.dateTo.slice(0, 10));
        setNote(absence.note ?? "");
      } else {
        setUserId(currentMember?.user?.id ?? "");
        setCategoryId(categories[0]?.id ?? "");
        setDateFrom(defaultDateFrom || format(new Date(), "yyyy-MM-dd"));
        setDateTo(defaultDateTo || format(new Date(), "yyyy-MM-dd"));
        setNote("");
      }
    }
  }, [open, absence, currentMember, categories, defaultDateFrom, defaultDateTo]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          categoryId,
          dateFrom,
          dateTo,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("employees.errorCreateAbsence"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastCreatedAbsence"));
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!absence) return;
      const res = await fetch(`/api/absences/${absence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || t("employees.errorSave"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastUpdatedAbsence"));
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const days = calculateDays(dateFrom, dateTo);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      toast.error(t("employees.selectCategoryError"));
      return;
    }
    if (days <= 0) {
      toast.error(t("employees.invalidDateRange"));
      return;
    }
    if (isEdit) {
      updateMutation.mutate({
        categoryId,
        dateFrom,
        dateTo,
        note: note.trim() || null,
      });
    } else {
      createMutation.mutate();
    }
  }

  function handleApprove() {
    if (!absence) return;
    updateMutation.mutate({ status: "APPROVED" });
  }

  function handleDecline() {
    if (!absence) return;
    updateMutation.mutate({ status: "DECLINED" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t("employees.editAbsenceTitle")
                : t("employees.requestAbsence")}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t("employees.editAbsenceDescription")
                : t("employees.createAbsenceDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Status badge for existing absences */}
            {isEdit && absence && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("employees.statusLabel")}</span>
                {getStatusBadge(absence.status, t)}
                {absence.user && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    {absence.user.lastName}, {absence.user.firstName}
                  </span>
                )}
              </div>
            )}

            {/* Employee select (only for admins in create mode) */}
            {!isEdit && isAdmin && employees.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("employees.employee")}</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("employees.selectEmployeePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.userId} value={emp.userId}>
                        {emp.lastName}, {emp.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category select */}
            <div className="space-y-1.5">
              <Label>{t("employees.category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("employees.selectCategoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.name}</span>
                        {!cat.isPaid && (
                          <span className="text-xs text-muted-foreground">
                            {t("employees.unpaidLabel")}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="absence-from">{t("employees.dateFrom")}</Label>
                <Input
                  id="absence-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="absence-to">{t("employees.dateTo")}</Label>
                <Input
                  id="absence-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Days count */}
            {days > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("employees.daysCount", { days })}
              </p>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="absence-note">{t("employees.noteOptionalLabel")}</Label>
              <Textarea
                id="absence-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("employees.absenceReasonPlaceholder")}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <div className="flex items-center gap-2 w-full">
              {/* Approve/Decline buttons for admin on pending absences */}
              {isEdit && isAdmin && absence?.status === "PENDING" && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApprove}
                    disabled={isPending}
                    className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    <Check className="size-4" />
                    {t("employees.approve")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDecline}
                    disabled={isPending}
                    className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <X className="size-4" />
                    {t("employees.decline")}
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isEdit ? t("common.save") : t("employees.submitRequest")}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { getStatusBadge, calculateDays };
export type { AbsenceData, AbsenceCategory, EmployeeOption };

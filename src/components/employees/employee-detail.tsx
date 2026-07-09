"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  Trash2,
  Loader2,
  StickyNote,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentMember } from "@/lib/hooks/use-current-member";

type EmployeeDetail = {
  id: string;
  role: string;
  isActive: boolean;
  isActivated: boolean;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    nickname: string | null;
    profileImage: string | null;
    createdAt: string;
  };
};

type Note = {
  id: string;
  subjectId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getRoleLabel(role: string, t: ReturnType<typeof useTranslations>) {
  switch (role) {
    case "OWNER":
      return t("employees.owner");
    case "ADMIN":
      return t("employees.admin");
    case "MANAGER":
      return t("employees.manager");
    default:
      return t("employees.employee");
  }
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case "OWNER":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "ADMIN":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
    case "MANAGER":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    default:
      return "";
  }
}

// Inline editable field component
function InlineEdit({
  value,
  onSave,
  type = "text",
  disabled = false,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    if (draft.trim() !== value) {
      onSave(draft.trim());
    }
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          className="h-7 text-sm"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleSave}
          className="text-emerald-600"
        >
          <Check className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCancel}
          className="text-muted-foreground"
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span className="text-sm">{value || "-"}</span>
      {!disabled && (
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="invisible group-hover:visible text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  );
}

export function EmployeeDetail({ memberId }: { memberId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const isAdmin =
    currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";
  const isManagerPlus =
    isAdmin || currentMember?.role === "MANAGER";

  // Fetch employee detail
  const {
    data: employee,
    isLoading,
    error,
  } = useQuery<EmployeeDetail>({
    queryKey: ["employee", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${memberId}`);
      if (!res.ok) throw new Error(t("employees.notFound"));
      return res.json();
    },
  });

  // Fetch notes
  const { data: notes } = useQuery<Note[]>({
    queryKey: ["employee-notes", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${memberId}/notes`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isManagerPlus,
  });

  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch(`/api/employees/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("employees.errorSave"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastSaved"));
      queryClient.invalidateQueries({ queryKey: ["employee", memberId] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Change role mutation
  const roleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/employees/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("employees.errorChangeRole"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastRoleChanged"));
      queryClient.invalidateQueries({ queryKey: ["employee", memberId] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("employees.errorDeactivate"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastDeactivated"));
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/employees");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Create note mutation
  const noteMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/employees/${memberId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("employees.errorSaveNote"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("employees.toastNoteSaved"));
      setNoteText("");
      queryClient.invalidateQueries({
        queryKey: ["employee-notes", memberId],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return <EmployeeDetailSkeleton />;
  }

  if (error || !employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/employees")}>
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </Button>
        <Card className="p-12 text-center">
          <p className="text-destructive">{t("employees.notFound")}</p>
        </Card>
      </div>
    );
  }

  const isSelf = employee.user.id === currentMember?.user?.id;
  const canEdit = isAdmin || isSelf;
  const canChangeRole = isAdmin && !isSelf && employee.role !== "OWNER";
  const canDelete = isAdmin && !isSelf && employee.role !== "OWNER";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/employees")}>
        <ArrowLeft className="size-4" />
        {t("employees.backToList")}
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {employee.user.profileImage && (
              <AvatarImage src={employee.user.profileImage} />
            )}
            <AvatarFallback className="text-lg">
              {getInitials(employee.user.firstName, employee.user.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {employee.user.lastName}, {employee.user.firstName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getRoleBadgeColor(employee.role)}>
                {getRoleLabel(employee.role, t)}
              </Badge>
              {!employee.isActive && (
                <Badge variant="destructive">{t("common.inactive")}</Badge>
              )}
              {employee.isActive && !employee.isActivated && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-600"
                >
                  {t("employees.notActivatedShort")}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions dropdown */}
        {(canChangeRole || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{t("employees.actions")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDelete && employee.isActive && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  {t("employees.deactivate")}
                </DropdownMenuItem>
              )}
              {canDelete && !employee.isActive && (
                <DropdownMenuItem
                  onClick={() => {
                    // Reactivate by updating isActive through a custom approach
                    // For now we use the PATCH endpoint concept
                    toast.info(t("employees.reactivateNotImplemented"));
                  }}
                >
                  {t("employees.reactivate")}
                </DropdownMenuItem>
              )}
              {canChangeRole && (
                <>
                  <DropdownMenuSeparator />
                  {["ADMIN", "MANAGER", "EMPLOYEE"]
                    .filter((r) => r !== employee.role)
                    .map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => roleMutation.mutate(r)}
                      >
                        {t("employees.changeRoleTo", { role: getRoleLabel(r, t) })}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left column - Contact info + Notes */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              {t("employees.contactData")}
            </h2>

            <div className="space-y-3">
              {/* Name */}
              <div className="grid grid-cols-[120px_1fr] items-center">
                <span className="text-sm text-muted-foreground">{t("employees.firstName")}</span>
                <InlineEdit
                  value={employee.user.firstName}
                  onSave={(v) => updateMutation.mutate({ firstName: v })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center">
                <span className="text-sm text-muted-foreground">{t("employees.lastName")}</span>
                <InlineEdit
                  value={employee.user.lastName}
                  onSave={(v) => updateMutation.mutate({ lastName: v })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center">
                <span className="text-sm text-muted-foreground">{t("employees.nickname")}</span>
                <InlineEdit
                  value={employee.user.nickname || ""}
                  onSave={(v) => updateMutation.mutate({ nickname: v })}
                  disabled={!canEdit}
                />
              </div>

              {/* Email */}
              <div className="grid grid-cols-[120px_1fr] items-center">
                <span className="text-sm text-muted-foreground">
                  <Mail className="inline size-3.5 mr-1" />
                  {t("employees.email")}
                </span>
                <InlineEdit
                  value={employee.user.email}
                  onSave={(v) => updateMutation.mutate({ email: v })}
                  type="email"
                  disabled={!canEdit}
                />
              </div>

              {/* Phone */}
              <div className="grid grid-cols-[120px_1fr] items-center">
                <span className="text-sm text-muted-foreground">
                  <Phone className="inline size-3.5 mr-1" />
                  {t("employees.phone")}
                </span>
                <InlineEdit
                  value={employee.user.phone || ""}
                  onSave={(v) => updateMutation.mutate({ phone: v })}
                  type="tel"
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Role change (inline) */}
            {canChangeRole && (
              <div className="grid grid-cols-[120px_1fr] items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">{t("employees.role")}</span>
                <Select
                  value={employee.role}
                  onValueChange={(v) => roleMutation.mutate(v)}
                  disabled={roleMutation.isPending}
                >
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{t("employees.admin")}</SelectItem>
                    <SelectItem value="MANAGER">{t("employees.manager")}</SelectItem>
                    <SelectItem value="EMPLOYEE">{t("employees.employee")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>

          {/* Quick Navigation */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              {t("common.navigation")}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                <Clock className="size-4" />
                {t("employees.hours")}
              </Button>
            </div>
          </Card>

          {/* Notes Section */}
          {isManagerPlus && (
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                <StickyNote className="inline size-3.5 mr-1" />
                {t("employees.notes")}
              </h2>

              {/* Add note form */}
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t("employees.addNotePlaceholder")}
                  className="min-h-[60px]"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    if (noteText.trim()) {
                      noteMutation.mutate(noteText.trim());
                    }
                  }}
                  disabled={!noteText.trim() || noteMutation.isPending}
                >
                  {noteMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>

              {/* Notes list */}
              {notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap">{note.text}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {note.author.firstName} {note.author.lastName}
                        </span>
                        <span>-</span>
                        <span>
                          {new Date(note.createdAt).toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("employees.noNotes")}
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Right column - E-Dash placeholder */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-4">
              {t("employees.monthOverview")}
            </h2>
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Clock className="size-10 opacity-30 mb-3" />
              <p className="text-sm font-medium">E-Dash</p>
              <p className="text-xs mt-1">
                {t("employees.hoursEvalComingSoon")}
              </p>
            </div>
          </Card>

          {/* Member Meta */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              {t("employees.membership")}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("employees.joined")}</span>
                <span>
                  {new Date(employee.joinedAt).toLocaleDateString(locale, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("employees.status")}</span>
                <span>
                  {employee.isActive ? t("common.active") : t("common.inactive")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("employees.activated")}</span>
                <span>{employee.isActivated ? t("employees.yes") : t("employees.no")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("employees.memberId")}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {employee.id}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("employees.deactivateConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("employees.deactivateConfirmDescription", {
                name: `${employee.user.firstName} ${employee.user.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate();
                setDeleteOpen(false);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t("employees.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmployeeRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

const emptyRow: EmployeeRow = {
  firstName: "",
  lastName: "",
  email: "",
  role: "EMPLOYEE",
};

export function EmployeeForm() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EmployeeRow[]>([{ ...emptyRow }]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (employees: EmployeeRow[]) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("employees.errorCreate"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.members?.length ?? 0;
      toast.success(t("employees.toastCreated", { count }));
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setRows([{ ...emptyRow }]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function updateRow(index: number, field: keyof EmployeeRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation
    const valid = rows.every(
      (r) => r.firstName.trim() && r.lastName.trim() && r.email.trim()
    );
    if (!valid) {
      toast.error(t("employees.requiredFieldsError"));
      return;
    }

    createMutation.mutate(rows);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t("employees.addNew")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("employees.addNew")}</DialogTitle>
            <DialogDescription>
              {t("employees.addNewDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-2 rounded-md border p-3"
              >
                <div className="space-y-1.5">
                  <Label>{t("employees.firstNameLabel")}</Label>
                  <Input
                    value={row.firstName}
                    onChange={(e) =>
                      updateRow(index, "firstName", e.target.value)
                    }
                    placeholder={t("employees.firstNamePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("employees.lastNameLabel")}</Label>
                  <Input
                    value={row.lastName}
                    onChange={(e) =>
                      updateRow(index, "lastName", e.target.value)
                    }
                    placeholder={t("employees.lastNamePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("employees.emailLabel")}</Label>
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(e) =>
                      updateRow(index, "email", e.target.value)
                    }
                    placeholder={t("employees.emailPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("employees.role")}</Label>
                  <Select
                    value={row.role}
                    onValueChange={(v) =>
                      updateRow(index, "role", v)
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">{t("employees.employee")}</SelectItem>
                      <SelectItem value="MANAGER">{t("employees.manager")}</SelectItem>
                      <SelectItem value="ADMIN">{t("employees.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={addRow}
          >
            <Plus className="size-4" />
            {t("employees.addAnother")}
          </Button>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t("employees.createSubmit", { count: rows.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

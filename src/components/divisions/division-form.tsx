"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Loader2, Pencil } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { nameKey: "divisions.colorIndigo", hex: "#6366f1" },
  { nameKey: "divisions.colorRed", hex: "#ef4444" },
  { nameKey: "divisions.colorGreen", hex: "#22c55e" },
  { nameKey: "divisions.colorBlue", hex: "#3b82f6" },
  { nameKey: "divisions.colorYellow", hex: "#eab308" },
  { nameKey: "divisions.colorPurple", hex: "#a855f7" },
  { nameKey: "divisions.colorPink", hex: "#ec4899" },
  { nameKey: "divisions.colorOrange", hex: "#f97316" },
];

type DivisionData = {
  id: string;
  title: string;
  description: string | null;
  color: string;
};

type DivisionFormProps = {
  division?: DivisionData;
  trigger?: React.ReactNode;
};

export function DivisionForm({ division, trigger }: DivisionFormProps) {
  const isEdit = !!division;
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].hex);
  const queryClient = useQueryClient();

  // Pre-fill for edit mode
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && division) {
      setTitle(division.title);
      setDescription(division.description ?? "");
      setColor(division.color);
    } else if (next && !division) {
      setTitle("");
      setDescription("");
      setColor(PRESET_COLORS[0].hex);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit
        ? `/api/divisions/${division.id}`
        : "/api/divisions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          color,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("divisions.errorSave"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? t("divisions.toastUpdated")
          : t("divisions.toastCreated")
      );
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("divisions.titleRequired"));
      return;
    }
    if (title.length > 100) {
      toast.error(t("divisions.titleMaxLength"));
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            {t("divisions.createNew")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t("divisions.editTitle")
                : t("divisions.createNew")}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t("divisions.editDescription")
                : t("divisions.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="division-title">{t("divisions.titleLabel")}</Label>
              <Input
                id="division-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("divisions.titlePlaceholder")}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/100
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="division-description">{t("divisions.descriptionLabel")}</Label>
              <Textarea
                id="division-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("divisions.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-1.5">
              <Label>{t("divisions.color")}</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    title={t(preset.nameKey)}
                    onClick={() => setColor(preset.hex)}
                    className={cn(
                      "size-8 rounded-full transition-all",
                      color === preset.hex
                        ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                        : "hover:scale-105"
                    )}
                    style={
                      {
                        backgroundColor: preset.hex,
                        "--tw-ring-color": preset.hex,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {isEdit ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Small edit button variant for use in cards
export function DivisionEditButton({ division }: { division: DivisionData }) {
  return (
    <DivisionForm
      division={division}
      trigger={
        <Button variant="ghost" size="icon" className="size-7">
          <Pencil className="size-3.5" />
        </Button>
      }
    />
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface AccountSettingsProps {
  orgName: string;
  orgAddress: string;
  onUpdate: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function AccountSettings({
  orgName,
  orgAddress,
  onUpdate,
  isSaving,
}: AccountSettingsProps) {
  const t = useTranslations();
  const [name, setName] = useState(orgName);
  const [address, setAddress] = useState(orgAddress);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const hasChanges = name !== orgName || address !== orgAddress;

  function handleSave() {
    const updates: Record<string, unknown> = {};
    if (name !== orgName) updates.name = name;
    if (address !== orgAddress) updates.address = address;
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("settings.account")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.accountDescription")}
        </p>
      </div>

      {/* Company info */}
      <Card className="p-6 space-y-4">
        <Label className="text-base font-semibold">{t("settings.companyData")}</Label>

        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>{t("auth.companyName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.companyNamePlaceholder")}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settings.address")}</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("settings.addressPlaceholder")}
              rows={3}
              disabled={isSaving}
            />
          </div>

          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <Label className="text-base font-semibold text-destructive">
            {t("settings.dangerZone")}
          </Label>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("settings.deleteAccountWarning")}
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t("settings.requestAccountDeletion")}
            </Button>
          ) : (
            <div className="space-y-3 max-w-md p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="text-sm font-medium">
                {t("settings.deleteConfirmPrompt")}
              </p>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={t("settings.deleteConfirmPlaceholder")}
                className="border-destructive/30"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteInput !== "LOESCHEN"}
                  onClick={() => {
                    // placeholder - not implemented
                    alert(t("settings.deleteRequestSent"));
                    setShowDeleteConfirm(false);
                    setDeleteInput("");
                  }}
                >
                  {t("settings.deleteIrreversibly")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteInput("");
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

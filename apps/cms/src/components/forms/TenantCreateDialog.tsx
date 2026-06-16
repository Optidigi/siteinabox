"use client"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { Plus } from "lucide-react"
import { TenantForm } from "./TenantForm"
import { useTranslations } from "next-intl"

/**
 * Modal wrapper around TenantForm — mirrors the UserInviteForm pattern so
 * "New tenant" matches "Invite team member" instead of opening a full page.
 * On success TenantForm navigates to onboarding, which unmounts the dialog.
 */
export function TenantCreateDialog() {
  const t = useTranslations("sites")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="mr-1 h-4 w-4" /> {t("new")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>
            {t("newDescription")}
          </DialogDescription>
        </DialogHeader>
        <TenantForm />
      </DialogContent>
    </Dialog>
  )
}

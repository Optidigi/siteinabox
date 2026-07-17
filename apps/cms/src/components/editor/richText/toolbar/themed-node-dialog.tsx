"use client"
import * as React from "react"
import { useForm, FormProvider } from "react-hook-form"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import type { RtManifest } from "@/lib/richText/manifest"
import { useTranslations } from "next-intl"

type ThemedNodeDef = NonNullable<RtManifest["themedNodes"]>[number]

export interface ThemedNodeDialogProps {
  def: ThemedNodeDef
  initial: Record<string, unknown>
  onSubmit: (props: Record<string, unknown>) => void
  onCancel: () => void
}

export const ThemedNodeDialog: React.FC<ThemedNodeDialogProps> = ({ def, initial, onSubmit, onCancel }) => {
  const tCommon = useTranslations("common")
  const methods = useForm({ defaultValues: initial })
  const submit = methods.handleSubmit((values) => onSubmit(values))
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent data-siab-editor-ui>
        <DialogHeader><DialogTitle>{def.label}</DialogTitle></DialogHeader>
        <FormProvider {...methods}>
          <form onSubmit={submit} className="space-y-3">
            {def.fields.map((f, i) => <FieldRenderer key={i} field={f as any} />)}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>
              <Button type="submit">{tCommon("save")}</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

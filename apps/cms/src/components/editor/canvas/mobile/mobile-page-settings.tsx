"use client"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { useTranslations } from "next-intl"

export interface MobilePageSettingsProps {
  renderPageSettings?: (context: MobilePageSettingsSlotContext) => React.ReactNode
}

export interface MobilePageSettingsSlotContext {
  header: React.ReactNode
  body: React.ReactNode
  titleField: React.ReactNode
  slugField: React.ReactNode
  statusField: React.ReactNode
}

export interface MobilePageSettingsLayoutProps {
  header: React.ReactNode
  body: React.ReactNode
}

export const MobilePageSettings: React.FC<MobilePageSettingsProps> = ({ renderPageSettings }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const tTable = useTranslations("table")
  const { watch, setValue } = useFormContext()
  const title = watch("title") as string | undefined
  const slug = watch("slug") as string | undefined
  const status = watch("status") as "draft" | "published" | undefined

  const header = (
    <header className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-border bg-background px-2 pt-14 pb-3">
      <h2 className="text-sm font-medium truncate">{t("pageSettings")}</h2>
    </header>
  )
  const titleField = (
    <div className="space-y-1.5">
          <Label htmlFor="mobile-page-title" className="text-sm">{tTable("title")}</Label>
          <Input id="mobile-page-title" value={title ?? ""} onChange={(e) => setValue("title", e.target.value, { shouldDirty: true })} />
        </div>
  )
  const slugField = (
    <div className="space-y-1.5">
          <Label htmlFor="mobile-page-slug" className="text-sm">{tTable("slug")}</Label>
          <Input
            id="mobile-page-slug"
            value={slug ?? ""}
            onChange={(e) => setValue("slug", e.target.value, { shouldDirty: true, shouldValidate: true })}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
  )
  const statusField = (
    <div className="space-y-1.5">
          <Label className="text-sm">{tTable("status")}</Label>
          <Select value={status ?? "draft"} onValueChange={(v) => setValue("status", v, { shouldDirty: true })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{tCommon("status.draft")}</SelectItem>
              <SelectItem value="published">{tCommon("status.published")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
  )
  const body = (
    <>
      {titleField}
      {slugField}
      {statusField}
    </>
  )

  if (renderPageSettings) {
    return (
      <>
        {renderPageSettings({ header, body, titleField, slugField, statusField })}
      </>
    )
  }

  return (
    <MobilePageSettingsLayout
      header={header}
      body={body}
    />
  )
}

export const MobilePageSettingsLayout: React.FC<MobilePageSettingsLayoutProps> = ({
  header,
  body,
}) => (
  <div data-mobile-page-settings>
    {header}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {body}
    </div>
  </div>
)

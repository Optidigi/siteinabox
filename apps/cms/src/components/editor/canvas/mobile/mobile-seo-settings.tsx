"use client"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { Image as ImageIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { MobileMediaSheet } from "@/components/editor/canvas/mobile/mobile-media-sheet"
import { useTranslations } from "next-intl"

const resolveUrl = (v: unknown): string | null => {
  if (!v) return null
  if (typeof v === "string") return v
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>
    if (typeof obj.url === "string") return obj.url
    if (typeof obj.filename === "string") return `/media/${obj.filename}`
  }
  return null
}

export interface MobileSeoSettingsProps {
  renderSeoSettings?: (context: MobileSeoSettingsSlotContext) => React.ReactNode
}

export interface MobileSeoSettingsSlotContext {
  header: React.ReactNode
  body: React.ReactNode
  titleField: React.ReactNode
  descriptionField: React.ReactNode
  imageField: React.ReactNode
  mediaSheet: React.ReactNode
}

export interface MobileSeoSettingsLayoutProps {
  header: React.ReactNode
  body: React.ReactNode
  mediaSheet: React.ReactNode
}

export const MobileSeoSettings: React.FC<MobileSeoSettingsProps> = ({ renderSeoSettings }) => {
  const t = useTranslations("editor")
  const { watch, setValue } = useFormContext()
  const seoTitle = watch("seo.title") as string | null | undefined
  const seoDescription = watch("seo.description") as string | null | undefined
  const ogImage = watch("seo.ogImage") as unknown
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const url = resolveUrl(ogImage)

  const header = (
    <header className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-border bg-background px-2 pt-14 pb-3">
      <h2 className="text-sm font-medium truncate">SEO</h2>
    </header>
  )
  const titleField = (
    <div className="space-y-1.5">
          <Label htmlFor="mobile-seo-title" className="text-sm">{t("seoTitle")}</Label>
          <Input id="mobile-seo-title" value={seoTitle ?? ""} onChange={(e) => setValue("seo.title", e.target.value, { shouldDirty: true })} />
        </div>
  )
  const descriptionField = (
    <div className="space-y-1.5">
          <Label htmlFor="mobile-seo-description" className="text-sm">{t("seoDescription")}</Label>
          <Textarea id="mobile-seo-description" value={seoDescription ?? ""} onChange={(e) => setValue("seo.description", e.target.value, { shouldDirty: true })} rows={4} />
        </div>
  )
  const imageField = (
    <div className="space-y-1.5">
          <Label className="text-sm">{t("openGraphImage")}</Label>
          {url ? (
            <img src={url} alt="" className="w-full max-h-48 object-cover rounded-md border border-border" />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground gap-2">
              <ImageIcon className="size-5" /> {t("noOgImage")}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(true)}>
              {url ? t("replace") : t("choose")}
            </Button>
            {url && (
              <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setValue("seo.ogImage", null, { shouldDirty: true })}>
                {t("remove")}
              </Button>
            )}
          </div>
        </div>
  )
  const body = (
    <>
      {titleField}
      {descriptionField}
      {imageField}
    </>
  )
  const mediaSheet = (
    <MobileMediaSheet open={sheetOpen} onOpenChange={setSheetOpen} onPick={(m) => setValue("seo.ogImage", m, { shouldDirty: true })} />
  )

  if (renderSeoSettings) {
    return (
      <>
        {renderSeoSettings({ header, body, titleField, descriptionField, imageField, mediaSheet })}
      </>
    )
  }

  return (
    <MobileSeoSettingsLayout
      header={header}
      body={body}
      mediaSheet={mediaSheet}
    />
  )
}

export const MobileSeoSettingsLayout: React.FC<MobileSeoSettingsLayoutProps> = ({
  header,
  body,
  mediaSheet,
}) => (
  <div data-mobile-seo-settings>
    {header}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {body}
    </div>
    {mediaSheet}
  </div>
)

"use client"

import { ChevronRight, PanelBottom, PanelTop } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@siteinabox/ui/components/button"

export type SiteChromeZone = "header" | "footer"
export type SiteChromeSelection = { zone: SiteChromeZone }
export function SiteChromeRow({
  zone,
  selected,
  onSelect,
}: {
  zone: SiteChromeZone
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  selected?: boolean
  onSelect?: (selection: SiteChromeSelection) => void
}) {
  const t = useTranslations("editor")
  const label = zone === "header" ? "Header" : "Footer"
  const Icon = zone === "header" ? PanelTop : PanelBottom

  return (
    <Button
      type="button"
      variant="ghost"
      className={`h-auto w-full justify-start gap-2 rounded-md border px-2 py-2 text-left hover:border-border hover:bg-accent/30 ${selected ? "border-border bg-accent/30" : "border-transparent"}`}
      aria-label={t("siteChromeActions", { zone: label })}
      onClick={() => onSelect?.({ zone })}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </Button>
  )
}

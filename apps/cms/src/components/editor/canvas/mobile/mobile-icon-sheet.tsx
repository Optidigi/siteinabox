"use client"
import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@siteinabox/ui/components/sheet"
import { Input } from "@siteinabox/ui/components/input"
import { Button } from "@siteinabox/ui/components/button"
import { Trash2 } from "lucide-react"
import { resolveLucideIcon } from "@/components/editor/icon-picker"
import { useTranslations } from "next-intl"

const CURATED_ICONS: Array<string> = [
  "ear", "heart-handshake", "clock", "check", "check-circle", "x", "plus",
  "minus", "star", "heart", "home", "map-pin", "phone", "mail", "user",
  "users", "lock", "shield", "shield-check", "info", "alert-circle",
  "calendar", "clock-3", "image", "file", "file-text", "search", "filter",
  "settings", "menu", "arrow-right", "arrow-left", "chevron-right",
  "chevron-down", "external-link", "link", "send", "smile", "frown",
  "thumbs-up", "leaf", "sun", "moon", "zap", "globe", "book", "book-open",
  "lightbulb", "rocket",
]

export interface MobileIconSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string | null
  onChange: (next: string | null) => void
}

export const MobileIconSheet: React.FC<MobileIconSheetProps> = ({ open, onOpenChange, value, onChange }) => {
  const t = useTranslations("editor")
  const [filter, setFilter] = React.useState("")
  const visible = CURATED_ICONS.filter((i) => i.toLowerCase().includes(filter.toLowerCase()))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] z-[60] overflow-y-auto px-4 pb-4"
        data-mobile-icon-sheet
        data-siab-editor-ui
        data-siab-canvas-chrome="mobile-icon-sheet"
      >
        <SheetHeader className="pb-3">
          <SheetTitle>{t("chooseIcon")}</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("filterIcons")}
            className="flex-1"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { onChange(null); onOpenChange(false) }}
              aria-label={t("removeIcon")}
            >
              <Trash2 className="size-5" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {visible.map((name) => {
            const Icon = resolveLucideIcon(name)
            const active = value === name
            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                onClick={() => { onChange(name); onOpenChange(false) }}
                className={[
                  "flex h-14 items-center justify-center rounded-md border border-border transition-colors",
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                ].join(" ")}
              >
                {Icon ? <Icon className="size-6" /> : <span className="text-xs">?</span>}
              </button>
            )
          })}
          {visible.length === 0 && (
            <div className="col-span-5 text-center text-sm text-muted-foreground py-6">
              No icons match &ldquo;{filter}&rdquo;
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

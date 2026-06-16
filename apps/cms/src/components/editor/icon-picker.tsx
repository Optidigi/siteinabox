"use client"
import * as React from "react"
import * as LucideIcons from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import { Input } from "@siteinabox/ui/components/input"
import { Button } from "@siteinabox/ui/components/button"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

/** Curated lucide-react icon names (kebab-case stored, PascalCase imported).
 *  Add to this list as tenants ask for more icons. Avoiding the full lucide
 *  bundle (>1000 icons) keeps the admin bundle reasonable. */
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

const toPascal = (kebab: string): string =>
  kebab.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")

/** Returns the lucide React component for a kebab-case icon name, or null. */
export const resolveLucideIcon = (kebab: string | null | undefined): React.ComponentType<any> | null => {
  if (!kebab) return null
  const pascal = toPascal(kebab)
  const Icon = (LucideIcons as any)[pascal]
  return Icon ?? null
}

export interface IconPickerProps {
  value?: string | null
  onChange: (next: string | null) => void
  trigger: React.ReactNode
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, trigger }) => {
  const t = useTranslations("editor")
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState("")
  const visible = CURATED_ICONS.filter((i) => i.toLowerCase().includes(filter.toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("filterIcons")}
            className="flex-1 h-8 text-sm"
          />
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(null); setOpen(false) }} aria-label={t("removeIcon")}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto">
          {visible.map((name) => {
            const Icon = resolveLucideIcon(name)
            const active = value === name
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => { onChange(name); setOpen(false) }}
                className={[
                  "flex items-center justify-center rounded-sm p-1.5 transition-colors",
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                ].join(" ")}
              >
                {Icon ? <Icon className="size-5" /> : <span className="text-xs">?</span>}
              </button>
            )
          })}
          {visible.length === 0 && (
            <div className="col-span-6 text-center text-xs text-muted-foreground py-4">
              No icons match &ldquo;{filter}&rdquo;
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

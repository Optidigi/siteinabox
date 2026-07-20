"use client"
import * as React from "react"
import { ChevronRight, X } from "lucide-react"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MediaPicker } from "@/components/media/MediaPicker"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { IconPicker, resolveLucideIcon } from "@/components/editor/icon-picker"
import type { ElementSpec } from "@/components/editor/blockElements"
import { asIconValue, asRtRootValue, type EditorArrayItem } from "@/lib/editor/blockFieldValues"
import type { RtManifest } from "@/lib/richText/manifest"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface ArrayItemCardProps {
  spec: ElementSpec
  item: EditorArrayItem
  itemIndex: number
  blockIndex: number
  onChange: (next: EditorArrayItem) => void
  onRemove: () => void
  manifest: RtManifest
}

export const ArrayItemCard: React.FC<ArrayItemCardProps> = ({
  spec,
  item,
  itemIndex,
  blockIndex,
  onChange,
  onRemove,
  manifest,
}) => {
  const [open, setOpen] = React.useState(false)
  const previewLabel = spec.itemLabel ? spec.itemLabel(item, itemIndex) : `${spec.label} ${itemIndex + 1}`
  const subFields = spec.itemFields ?? []

  return (
    <div className="group/card rounded-md border border-border bg-background">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left text-xs"
          aria-expanded={open}
        >
          <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />
          <span className="truncate font-medium">{previewLabel}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${previewLabel}`}
          className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 focus:opacity-100 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {open && subFields.length > 0 && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          {subFields.map((sub) => (
            <SubFieldRenderer
              key={sub.field}
              sub={sub}
              value={item[sub.field]}
              onChange={(next) => onChange({ ...item, [sub.field]: next })}
              blockIndex={blockIndex}
              itemIndex={itemIndex}
              manifest={manifest}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SubFieldRenderer: React.FC<{
  sub: ElementSpec
  value: unknown
  onChange: (next: unknown) => void
  blockIndex: number
  itemIndex: number
  manifest: RtManifest
}> = ({ sub, value, onChange, blockIndex, itemIndex, manifest }) => {
  const t = useTranslations("editor")
  if (sub.kind === "richtext") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{sub.label}</Label>
        <LexicalField
          key={`${blockIndex}.${itemIndex}.${sub.field}`}
          variant={sub.variant ?? "inline"}
          value={asRtRootValue(value)}
          onChange={onChange}
          manifest={manifest}
          placeholder={sub.label}
        />
      </div>
    )
  }
  if (sub.kind === "text") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{sub.label}</Label>
        <Input
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  if (sub.kind === "image") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{sub.label}</Label>
        <MediaPicker value={value} onChange={onChange} />
      </div>
    )
  }
  if (sub.kind === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{sub.label}</Label>
        <Select
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onValueChange={onChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={sub.label} />
          </SelectTrigger>
          <SelectContent data-siab-editor-ui>
            {(sub.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (sub.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span>{sub.label}</span>
      </label>
    )
  }
  if (sub.kind === "icon") {
    const iconValue = asIconValue(value)
    const Icon = resolveLucideIcon(iconValue)
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{sub.label}</Label>
        <IconPicker
          value={iconValue}
          onChange={onChange}
          trigger={
            <button type="button" className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent/30">
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className={Icon ? undefined : "text-muted-foreground"}>{iconValue ?? t("chooseIcon")}</span>
            </button>
          }
        />
      </div>
    )
  }
  return <p className="text-xs text-muted-foreground">{t("unknownSubFieldKind", { kind: String(sub.kind) })}</p>
}

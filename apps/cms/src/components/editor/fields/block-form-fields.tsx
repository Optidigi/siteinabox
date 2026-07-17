"use client"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MediaPicker } from "@/components/media/MediaPicker"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { IconPicker, resolveLucideIcon } from "@/components/editor/icon-picker"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { getBlockElementSpecs, type ElementSpec } from "@/components/editor/blockElements"
import { ArrayItemCard } from "@/components/editor/fields/array-item-card"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { inspectorThemeDeclarations } from "@/lib/theme/inspectorFonts"
import { useTranslations } from "next-intl"

export interface BlockFormFieldsProps {
  block: any
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
}

export const BlockFormFields: React.FC<BlockFormFieldsProps> = ({ block, blockIndex, manifest, theme }) => {
  const blockType: string | undefined = block?.blockType
  const specs: ElementSpec[] = getBlockElementSpecs(blockType, manifest)
  const inspectorFonts = useCspStyleRule(
    "block-form-inspector-fonts",
    inspectorThemeDeclarations(theme),
  )

  return (
    <>
      {inspectorFonts.styleElement}
      <div className={`${inspectorFonts.className} space-y-4`}>
        {specs.map((spec) =>
          spec.kind === "array" ? (
            <ArraySection
              key={spec.field}
              spec={spec}
              block={block}
              blockIndex={blockIndex}
              manifest={manifest}
            />
          ) : (
            <FieldRenderer
              key={spec.field}
              spec={spec}
              block={block}
              blockIndex={blockIndex}
              manifest={manifest}
              theme={theme}
            />
          ),
        )}
      </div>
    </>
  )
}

const FieldRenderer: React.FC<{
  spec: ElementSpec
  block: any
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
}> = ({ spec, block: _block, blockIndex, manifest, theme }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { watch, setValue } = useFormContext()
  const name = `blocks.${blockIndex}.${spec.field}`
  const value = watch(name)
  const setShouldDirty = (next: unknown) => setValue(name, next, { shouldDirty: true })

  if (spec.kind === "richtext") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <div className={roleBodyFontClass(spec.role)}>
          <LexicalField
            key={`${blockIndex}.${spec.field}`}
            variant={spec.variant ?? "inline"}
            value={value}
            onChange={setShouldDirty}
            manifest={manifest}
            placeholder={spec.label}
            allowFontFamily={_block?.blockType === "richText"}
            theme={theme}
          />
        </div>
      </div>
    )
  }

  if (spec.kind === "text") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Input
          value={value ?? ""}
          onChange={(e) => setShouldDirty(e.target.value)}
          className={roleFontClass(spec.role)}
        />
      </div>
    )
  }

  if (spec.kind === "image") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <MediaPicker value={value} onChange={setShouldDirty} />
      </div>
    )
  }

  if (spec.kind === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Select value={value ?? ""} onValueChange={setShouldDirty}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={spec.label} />
          </SelectTrigger>
          <SelectContent data-siab-editor-ui>
            {(spec.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (spec.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => setShouldDirty(checked === true)}
        />
        <span>{spec.label}</span>
      </label>
    )
  }

  if (spec.kind === "icon") {
    const iconValue: string | null = value ?? null
    const Icon = resolveLucideIcon(iconValue)
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <IconPicker
          value={iconValue}
          onChange={setShouldDirty}
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent/30"
            >
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className={Icon ? undefined : "text-muted-foreground"}>
                {iconValue ?? t("chooseIcon")}
              </span>
            </button>
          }
        />
      </div>
    )
  }

  if (spec.kind === "cta") {
    const cta = (value ?? {}) as { label?: string; href?: string }
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <div className="space-y-2 pl-1">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("label")}</Label>
            <Input
              value={cta.label ?? ""}
              onChange={(e) => setShouldDirty({ ...cta, label: e.target.value })}
              placeholder={t("buttonText")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tCommon("url")}</Label>
            <Input
              value={cta.href ?? ""}
              onChange={(e) => setShouldDirty({ ...cta, href: e.target.value })}
              placeholder={t("urlPlaceholder")}
              inputMode="url"
            />
          </div>
        </div>
      </div>
    )
  }

  return <p className="text-xs text-muted-foreground">{t("unknownFieldKind", { kind: String(spec.kind) })}</p>
}

const ArraySection: React.FC<{
  spec: ElementSpec
  block: any
  blockIndex: number
  manifest: RtManifest
}> = ({ spec, block: _block, blockIndex, manifest }) => {
  const { watch, setValue } = useFormContext()
  const name = `blocks.${blockIndex}.${spec.field}`
  const items: any[] = watch(name) ?? []

  function setItems(next: any[]) {
    setValue(name, next, { shouldDirty: true })
  }

  return (
    <section className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{spec.label}</Label>
      <div className="space-y-2">
        {items.map((item, itemIndex) => (
          <ArrayItemCard
            key={item.id ?? itemIndex}
            spec={spec}
            item={item}
            itemIndex={itemIndex}
            blockIndex={blockIndex}
            onChange={(next) => {
              const copy = [...items]
              copy[itemIndex] = next
              setItems(copy)
            }}
            onRemove={() => {
              const copy = items.filter((_, j) => j !== itemIndex)
              setItems(copy)
            }}
            manifest={manifest}
          />
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, {}])}
          className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/30"
        >
          + Add {spec.itemLabel ? spec.itemLabel({}, items.length) : "item"}
        </button>
      </div>
    </section>
  )
}

function roleFontClass(role: ElementSpec["role"]): string {
  if (role === "title") return "[font-family:var(--rt-inspector-font-title,inherit)]"
  if (role === "heading") return "[font-family:var(--rt-inspector-font-heading,inherit)]"
  if (role === "text") return "[font-family:var(--rt-inspector-font-text,inherit)]"
  return "[font-family:inherit]"
}

function roleBodyFontClass(role: ElementSpec["role"]): string {
  if (role === "title") return "[--rt-inspector-font-body:var(--rt-inspector-font-title,inherit)]"
  if (role === "heading") return "[--rt-inspector-font-body:var(--rt-inspector-font-heading,inherit)]"
  if (role === "text") return "[--rt-inspector-font-body:var(--rt-inspector-font-text,inherit)]"
  return "[--rt-inspector-font-body:inherit]"
}

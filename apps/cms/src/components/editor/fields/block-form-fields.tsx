"use client"
import * as React from "react"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MediaPicker } from "@/components/media/MediaPicker"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { IconPicker, resolveLucideIcon } from "@/components/editor/icon-picker"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { getBlockElementSpecs, type ElementSpec } from "@/components/editor/blockElements"
import { ArrayItemCard } from "@/components/editor/fields/array-item-card"
import {
  useBlockArrayFieldController,
  useBlockFieldController,
} from "@/components/editor/fields/fieldController"
import { isPersistedEditorBlock, type EditorBlock } from "@/lib/editor/editorBlock"
import { asCtaValue, asIconValue, asRtRootValue, updateCtaHref, updateCtaLabel } from "@/lib/editor/blockFieldValues"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { inspectorThemeDeclarations } from "@/lib/theme/inspectorFonts"
import { useTranslations } from "next-intl"
import { getProviderBlockVariant } from "@siteinabox/contracts"

export interface BlockFormFieldsProps {
  block: EditorBlock
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
}

const resolveProviderVariant = (block: EditorBlock) => {
  if (!isPersistedEditorBlock(block)) return null
  return getProviderBlockVariant(block)
}

export const BlockFormFields: React.FC<BlockFormFieldsProps> = ({ block, blockIndex, manifest, theme }) => {
  const blockType = block.blockType
  const providerVariant = resolveProviderVariant(block)
  const specs: ElementSpec[] = getBlockElementSpecs(blockType, manifest).filter((spec) =>
    !providerVariant || (providerVariant.slots as Record<string, { status: string }>)[spec.field]?.status !== "inactive",
  )
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
  block: EditorBlock
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
}> = ({ spec, block, blockIndex, manifest, theme }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { value, setValue } = useBlockFieldController({ blockIndex, field: spec.field })

  if (spec.kind === "richtext") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <div className={roleBodyFontClass(spec.role)}>
          <LexicalField
            key={`${blockIndex}.${spec.field}`}
            variant={spec.variant ?? "inline"}
            value={asRtRootValue(value)}
            onChange={setValue}
            manifest={manifest}
            placeholder={spec.label}
            allowFontFamily={block.blockType === "richText"}
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
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(e) => setValue(e.target.value)}
          className={roleFontClass(spec.role)}
        />
      </div>
    )
  }

  if (spec.kind === "image") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <MediaPicker value={value} onChange={setValue} />
      </div>
    )
  }

  if (spec.kind === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Select value={typeof value === "string" ? value : value == null ? "" : String(value)} onValueChange={setValue}>
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
          onCheckedChange={(checked) => setValue(checked === true)}
        />
        <span>{spec.label}</span>
      </label>
    )
  }

  if (spec.kind === "icon") {
    const iconValue = asIconValue(value)
    const Icon = resolveLucideIcon(iconValue)
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <IconPicker
          value={iconValue}
          onChange={setValue}
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
    const cta = asCtaValue(value)
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <div className="space-y-2 pl-1">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("label")}</Label>
            <Input
              value={cta.label ?? ""}
              onChange={(e) => setValue(updateCtaLabel(cta, e.target.value))}
              placeholder={t("buttonText")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tCommon("url")}</Label>
            <Input
              value={cta.href ?? ""}
              onChange={(e) => setValue(updateCtaHref(cta, e.target.value))}
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
  blockIndex: number
  manifest: RtManifest
}> = ({ spec, blockIndex, manifest }) => {
  const { items, updateItem, removeItem, appendItem } = useBlockArrayFieldController({
    blockIndex,
    field: spec.field,
  })

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
            onChange={(next) => updateItem(itemIndex, next)}
            onRemove={() => removeItem(itemIndex)}
            manifest={manifest}
          />
        ))}
        <button
          type="button"
          onClick={() => appendItem()}
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

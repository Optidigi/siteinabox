"use client"
import * as React from "react"
import { ChevronDown } from "lucide-react"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MediaPicker } from "@/components/media/MediaPicker"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { IconPicker, resolveLucideIcon } from "@/components/editor/icon-picker"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@siteinabox/ui/components/collapsible"
import {
  getBlockElementSpecs,
  partitionBlockElementSpecs,
  type ElementSpec,
} from "@/components/editor/blockElements"
import type { ElementPath } from "@/components/editor/elementPath"
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
import { getProviderBlockVariant, SITE_BLOCK_CATALOG_BY_SLUG } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"

export interface BlockFormFieldsProps {
  block: EditorBlock
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
  /** When set, scroll/highlight the matching inspector field (canvas deep-link). */
  highlightPath?: ElementPath | null
}

const ADVANCED_LABEL_KEYS = new Set(["designVariant", "anchor", "metadata", "trustLabel"])

const resolveProviderVariant = (block: EditorBlock) => {
  if (!isPersistedEditorBlock(block)) return null
  return getProviderBlockVariant(block)
}

function useLocalizedSpecLabel() {
  const t = useTranslations("editor")
  return React.useCallback((spec: ElementSpec): string => {
    if (!ADVANCED_LABEL_KEYS.has(spec.field)) return spec.label
    const key = spec.field as "designVariant" | "anchor" | "metadata" | "trustLabel"
    return t.has(key) ? t(key) : spec.label
  }, [t])
}

export const BlockFormFields: React.FC<BlockFormFieldsProps> = ({ block, blockIndex, manifest, theme, highlightPath }) => {
  const t = useTranslations("editor")
  const localizeLabel = useLocalizedSpecLabel()
  const blockType = block.blockType
  const providerVariant = resolveProviderVariant(block)
  const allSpecs = getBlockElementSpecs(blockType, manifest)
  const { content, advanced } = partitionBlockElementSpecs(
    allSpecs,
    providerVariant?.slots as Record<string, { status: string }> | undefined,
  )
  const inspectorFonts = useCspStyleRule(
    "block-form-inspector-fonts",
    inspectorThemeDeclarations(theme),
  )
  const highlightField = highlightPath?.blockIndex === blockIndex && highlightPath.field
    ? highlightPath.field
    : null
  const highlightItemIndex = highlightPath?.blockIndex === blockIndex ? highlightPath.itemIndex : undefined
  const highlightKey = highlightField
    ? `${blockIndex}.${highlightField}.${highlightItemIndex ?? ""}.${highlightPath?.subField ?? ""}`
    : null
  const highlightInAdvanced = Boolean(
    highlightField && advanced.some((spec) => spec.field === highlightField),
  )
  const [advancedOpen, setAdvancedOpen] = React.useState(highlightInAdvanced)

  React.useEffect(() => {
    if (highlightInAdvanced) setAdvancedOpen(true)
  }, [highlightInAdvanced, highlightKey])

  React.useLayoutEffect(() => {
    if (!highlightKey || !highlightField) return
    const selector = highlightItemIndex != null
      ? `[data-siab-inspector-field="${CSS.escape(highlightField)}"][data-siab-inspector-item-index="${CSS.escape(String(highlightItemIndex))}"]`
      : `[data-siab-inspector-field="${CSS.escape(highlightField)}"]`
    const node = document.querySelector<HTMLElement>(selector)
    if (!node) return
    node.setAttribute("data-siab-inspector-field-selected", "true")
    node.scrollIntoView({ behavior: "smooth", block: "center" })
    const timer = window.setTimeout(() => {
      node.removeAttribute("data-siab-inspector-field-selected")
    }, 1600)
    return () => {
      window.clearTimeout(timer)
      node.removeAttribute("data-siab-inspector-field-selected")
    }
  }, [highlightField, highlightItemIndex, highlightKey, advancedOpen])

  const renderSpec = (spec: ElementSpec) => {
    const labeled = { ...spec, label: localizeLabel(spec) }
    if (spec.kind === "array") {
      return (
        <ArraySection
          key={spec.field}
          spec={labeled}
          blockIndex={blockIndex}
          manifest={manifest}
          highlightPath={highlightPath?.blockIndex === blockIndex ? highlightPath : null}
        />
      )
    }
    return (
      <div
        key={spec.field}
        data-siab-inspector-field={spec.field}
        className={cn(
          "rounded-md transition-[box-shadow,background-color] duration-300",
          highlightField === spec.field && highlightItemIndex == null
            && "bg-accent/20 ring-2 ring-accent/50",
        )}
      >
        <FieldRenderer
          spec={labeled}
          block={block}
          blockIndex={blockIndex}
          manifest={manifest}
          theme={theme}
        />
      </div>
    )
  }

  return (
    <>
      {inspectorFonts.styleElement}
      <div className={`${inspectorFonts.className} space-y-4`}>
        {content.map(renderSpec)}
        {advanced.length > 0 ? (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30"
            >
              <span>{t("inspectorAdvanced")}</span>
              <ChevronDown className={cn("size-3.5 transition-transform", advancedOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {advanced.map(renderSpec)}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
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

  if (spec.field === "designVariant") {
    const catalog = SITE_BLOCK_CATALOG_BY_SLUG[block.blockType as keyof typeof SITE_BLOCK_CATALOG_BY_SLUG]
    const variants = catalog?.variants ?? []
    const current = typeof value === "string" ? value : value == null ? "" : String(value)
    if (variants.length > 0) {
      return (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{spec.label}</Label>
          <Select value={current || undefined} onValueChange={setValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={spec.label} />
            </SelectTrigger>
            <SelectContent data-siab-editor-ui>
              {variants.map((variant) => (
                <SelectItem key={variant.variant} value={variant.variant}>
                  {variant.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }
  }

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
  highlightPath?: ElementPath | null
}> = ({ spec, blockIndex, manifest, highlightPath }) => {
  const t = useTranslations("editor")
  const { items, updateItem, removeItem, appendItem } = useBlockArrayFieldController({
    blockIndex,
    field: spec.field,
  })
  const itemName = spec.itemLabel ? spec.itemLabel({}, items.length) : spec.label

  return (
    <section
      className="space-y-2"
      data-siab-inspector-field={spec.field}
    >
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{spec.label}</Label>
      <div className="space-y-2">
        {items.map((item, itemIndex) => (
          <div
            key={item.id ?? itemIndex}
            data-siab-inspector-field={spec.field}
            data-siab-inspector-item-index={String(itemIndex)}
            className={cn(
              "rounded-md transition-[box-shadow,background-color] duration-300",
              highlightPath?.field === spec.field && highlightPath.itemIndex === itemIndex
                && "bg-accent/20 ring-2 ring-accent/50",
            )}
          >
            <ArrayItemCard
              spec={spec}
              item={item}
              itemIndex={itemIndex}
              blockIndex={blockIndex}
              onChange={(next) => updateItem(itemIndex, next)}
              onRemove={() => removeItem(itemIndex)}
              manifest={manifest}
              forceOpen={highlightPath?.field === spec.field && highlightPath.itemIndex === itemIndex}
              highlightSubField={
                highlightPath?.field === spec.field && highlightPath.itemIndex === itemIndex
                  ? highlightPath.subField ?? null
                  : null
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendItem()}
          className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/30"
        >
          {t("addItem", { item: itemName })}
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

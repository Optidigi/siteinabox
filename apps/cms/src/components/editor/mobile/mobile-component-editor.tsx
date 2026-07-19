"use client"
import * as React from "react"
import { Check, Image as ImageIcon } from "lucide-react"
import { Drawer as Vaul } from "vaul"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { getBlockElementSpecs, type ElementSpec } from "@/components/editor/blockElements"
import type { ElementPath } from "@/components/editor/elementPath"
import { useElementPathFieldController } from "@/components/editor/fields/fieldController"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { inspectorThemeDeclarations } from "@/lib/theme/inspectorFonts"
import { useMobileEditor, type MobileSnap } from "@/components/editor/mobile/MobileEditorContext"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MobileMediaSheet } from "@/components/editor/mobile/mobile-media-sheet"
import { MobileIconSheet } from "@/components/editor/mobile/mobile-icon-sheet"
import { resolveLucideIcon } from "@/components/editor/icon-picker"
import { MobileArrayDrilldown } from "@/components/editor/mobile/mobile-array-drilldown"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import {
  asCtaValue,
  asIconValue,
  asRtRootValue,
  resolveMediaDisplayUrl,
  updateCtaHref,
  updateCtaLabel,
  type EditorIconValue,
  type EditorMediaValue,
} from "@/lib/editor/blockFieldValues"
import { useTranslations } from "next-intl"

export interface MobileComponentEditorProps {
  path: ElementPath
  block: EditorBlock
  manifest: RtManifest
  theme?: ThemeTokens | null
}

/**
 * Dispatches to a per-kind editor body based on the element's ElementSpec.
 * Mirrors BlockFormFields.FieldRenderer from the desktop sidebar — same code
 * paths per kind, different presentation (vaul-sized sheet vs. side aside).
 */
export const MobileComponentEditor: React.FC<MobileComponentEditorProps> = ({ path, block, manifest, theme }) => {
  const t = useTranslations("editor")
  const { clearSelection, focusPop } = useMobileEditor()
  const blockType = block.blockType
  const specs: ElementSpec[] = getBlockElementSpecs(blockType, manifest)

  const parentSpec = specs.find((s) => s.field === path.field)
  let activeSpec: ElementSpec | undefined = parentSpec
  if (parentSpec?.kind === "array" && path.subField) {
    activeSpec = parentSpec.itemFields?.find((s) => s.field === path.subField)
  }

  const label = activeSpec?.label ?? path.field
  const closeEditor = React.useCallback(() => clearSelection(), [clearSelection])
  const handleCloseClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    closeEditor()
  }, [closeEditor])
  const focusReadyRef = React.useRef(false)
  const recentEditablePointerRef = React.useRef(0)
  const inspectorFonts = useCspStyleRule(
    "mobile-component-inspector-fonts",
    inspectorThemeDeclarations(theme),
  )
  React.useLayoutEffect(() => {
    focusReadyRef.current = false
    const frame = window.requestAnimationFrame(() => {
      focusReadyRef.current = true
    })
    return () => window.cancelAnimationFrame(frame)
  }, [path.blockIndex, path.field, path.itemIndex, path.subField])

  const onEditorPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (getEditableFocusTarget(event.target)) {
      recentEditablePointerRef.current = performance.now()
    }
  }, [])

  const onEditorFocus = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!getEditableFocusTarget(event.target)) return

    const hasRecentEditablePointer = performance.now() - recentEditablePointerRef.current < 750
    if (!focusReadyRef.current && !hasRecentEditablePointer) return

    focusPop()
  }, [focusPop])

  return (
    <div data-mobile-editor className={`${inspectorFonts.className} flex h-full min-h-0 flex-col`}>
      {inspectorFonts.styleElement}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <span className="text-sm font-medium truncate">{label}</span>
        <Vaul.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full border border-border bg-muted text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            onClick={handleCloseClick}
            aria-label={t("doneEditing")}
            data-mobile-editor-close
          >
            <Check className="size-4" aria-hidden />
          </Button>
        </Vaul.Close>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y"
        onPointerDownCapture={onEditorPointerDown}
        onFocusCapture={onEditorFocus}
      >
        <MobileFieldRenderer spec={activeSpec} parentSpec={parentSpec} path={path} manifest={manifest} blockType={blockType} />
      </div>
    </div>
  )
}

const MobileFieldRenderer: React.FC<{
  spec: ElementSpec | undefined
  parentSpec: ElementSpec | undefined
  path: ElementPath
  manifest: RtManifest
  blockType: string
}> = ({ spec, parentSpec, path, manifest, blockType }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { value, setValue } = useElementPathFieldController(path)
  const { expandTo } = useMobileEditor()

  const isArraySubField = parentSpec?.kind === "array" && path.subField != null
  if (isArraySubField && parentSpec) {
    return (
      <MobileArrayDrilldown
        spec={parentSpec}
        blockIndex={path.blockIndex}
        manifest={manifest}
      />
    )
  }

  if (!spec) return <p className="text-xs text-muted-foreground">{t("noEditorForElement")}</p>

  if (spec.kind === "text") {
    return (
      <div className="space-y-2 pb-4" data-mobile-editor-kind="text">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Input
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(e) => setValue(e.target.value)}
          className={roleFontClass(spec.role)}
        />
      </div>
    )
  }
  if (spec.kind === "richtext") {
    return (
      <div className="space-y-2 pb-4" data-mobile-editor-kind="richtext">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <div
          className={`${roleBodyFontClass(spec.role)} rounded-md border border-border bg-background px-3 py-2`}
        >
          <LexicalField
            key={`mobile-${path.blockIndex}.${spec.field}${path.itemIndex ?? ""}${path.subField ?? ""}`}
            variant={spec.variant ?? "inline"}
            value={asRtRootValue(value)}
            onChange={setValue}
            manifest={manifest}
            placeholder={spec.label}
            allowFontFamily={blockType === "richText"}
          />
        </div>
      </div>
    )
  }
  if (spec.kind === "cta") {
    const cta = asCtaValue(value)
    return (
      <div className="space-y-3 pb-4" data-mobile-editor-kind="cta">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("label")}</Label>
          <Input
            value={cta.label ?? ""}
            onChange={(e) => setValue(updateCtaLabel(cta, e.target.value))}
            placeholder={t("buttonText")}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{tCommon("url")}</Label>
          <Input
            value={cta.href ?? ""}
            onChange={(e) => setValue(updateCtaHref(cta, e.target.value))}
            placeholder={t("urlPlaceholder")}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>
    )
  }
  if (spec.kind === "select") {
    return (
      <div className="space-y-2 pb-4" data-mobile-editor-kind="select">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Select
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onValueChange={setValue}
        >
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
      <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm" data-mobile-editor-kind="checkbox">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => setValue(checked === true)}
        />
        <span>{spec.label}</span>
      </label>
    )
  }
  if (spec.kind === "image") {
    return <ImageEditor value={value} setValue={setValue} expandTo={expandTo} />
  }
  if (spec.kind === "icon") {
    return <IconEditor value={value} setValue={setValue} expandTo={expandTo} />
  }
  if (spec.kind === "array") {
    return (
      <MobileArrayDrilldown
        spec={spec}
        blockIndex={path.blockIndex}
        manifest={manifest}
      />
    )
  }
  return <p className="text-xs text-muted-foreground">{t("unknownFieldKind", { kind: spec.kind })}</p>
}

const ImageEditor: React.FC<{
  value: unknown
  setValue: (next: EditorMediaValue) => void
  expandTo: (snap: MobileSnap) => void
}> = ({ value, setValue, expandTo }) => {
  const t = useTranslations("editor")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const url = resolveMediaDisplayUrl(value)
  return (
    <div className="space-y-3 pb-4" data-mobile-editor-kind="image">
      {url ? (
        <img src={url} alt="" className="w-full max-h-48 object-cover rounded-md border border-border" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground gap-2">
          <ImageIcon className="size-5" />
          {t("noImage")}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => { expandTo(0.92); setSheetOpen(true) }}
        >
          {url ? t("replace") : t("choose")}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setValue(null)}
          >
            {t("remove")}
          </Button>
        )}
      </div>
      <MobileMediaSheet
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) expandTo(0.42) }}
        onPick={setValue}
      />
    </div>
  )
}

const IconEditor: React.FC<{
  value: unknown
  setValue: (next: EditorIconValue) => void
  expandTo: (snap: MobileSnap) => void
}> = ({ value, setValue, expandTo }) => {
  const t = useTranslations("editor")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const iconName = asIconValue(value)
  const Icon = resolveLucideIcon(iconName)

  return (
    <div className="space-y-3 pb-4" data-mobile-editor-kind="icon">
      <button
        type="button"
        onClick={() => { expandTo(0.92); setSheetOpen(true) }}
        className="flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-3 text-sm hover:bg-accent/30"
      >
        {Icon ? <Icon className="size-6 shrink-0" /> : null}
        <span className={Icon ? undefined : "text-muted-foreground"}>
          {iconName ?? t("chooseIcon")}
        </span>
      </button>
      <MobileIconSheet
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) expandTo(0.42) }}
        value={iconName}
        onChange={setValue}
      />
    </div>
  )
}

function getEditableFocusTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  const candidate = target.closest("input,textarea,[contenteditable]")
  if (!(candidate instanceof HTMLElement)) return null
  if (candidate.getAttribute("aria-disabled") === "true") return null
  if (candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) {
    return candidate.disabled ? null : candidate
  }
  return candidate.isContentEditable ? candidate : null
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

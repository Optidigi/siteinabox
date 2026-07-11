"use client"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { Check, Image as ImageIcon } from "lucide-react"
import { Drawer as Vaul } from "vaul"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { getBlockElementSpecs, type ElementSpec } from "@/components/editor/canvas/blockElements"
import type { ElementPath } from "@/components/editor/canvas/elementPath"
import { elementPathToName } from "@/components/editor/canvas/elementPath"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { resolveThemeTokens } from "@siteinabox/site-renderer/theme/resolve"
import { useMobileEditor, type MobileSnap } from "@/components/editor/canvas/mobile/MobileEditorContext"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MobileMediaSheet } from "@/components/editor/canvas/mobile/mobile-media-sheet"
import { MobileIconSheet } from "@/components/editor/canvas/mobile/mobile-icon-sheet"
import { resolveLucideIcon } from "@/components/editor/icon-picker"
import { MobileArrayDrilldown } from "@/components/editor/canvas/mobile/mobile-array-drilldown"
import { useTranslations } from "next-intl"

export interface MobileComponentEditorProps {
  path: ElementPath
  block: any
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
  const blockType: string | undefined = block?.blockType
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
    inspectorFontDeclarations(theme),
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
      {/* Single scroll owner for the sheet — always scrollable so content
          taller than the active detent can still be reached (FE-74).
          Vaul's drag arbitration lets a downward pull from scroll-top drag the
          sheet while normal upward/mid-content gestures keep scrolling here.
          overscroll-contain reduces scroll-chain escape into Safari refresh.
          Editable-field focus pops the sheet to the editing detent so the
          focused field clears the keyboard. Programmatic mount-time focus is
          ignored for the first frame so selection visibly settles at 0.42. */}
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
  blockType: string | undefined
}> = ({ spec, parentSpec, path, manifest, blockType }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { watch, setValue } = useFormContext()
  const { expandTo } = useMobileEditor()
  const name = elementPathToName(path)
  const value = watch(name)

  // If the selected element is a sub-field of an array, route through
  // MobileArrayDrilldown so the user gets the array-list/array-item chrome
  // (back arrow, item label, trash) wrapping the sub-field editor. The
  // drill stack was already seeded by SET_SELECTED.
  const isArraySubField = parentSpec?.kind === "array" && path.subField != null
  if (isArraySubField && parentSpec) {
    const arrayName = `blocks.${path.blockIndex}.${parentSpec.field}`
    return (
      <MobileArrayDrilldown
        spec={parentSpec}
        blockIndex={path.blockIndex}
        manifest={manifest}
        arrayName={arrayName}
      />
    )
  }

  if (!spec) return <p className="text-xs text-muted-foreground">{t("noEditorForElement")}</p>
  // Inputs below deliberately omit autoFocus: grabbing focus while the bottom
  // sheet is still animating open pops the keyboard mid-transition, so the
  // sheet never shifts up. The user taps a field to focus it.
  if (spec.kind === "text") {
    return (
      <div className="space-y-2 pb-4" data-mobile-editor-kind="text">
        <Label className="text-xs text-muted-foreground">{spec.label}</Label>
        <Input
          value={value ?? ""}
          onChange={(e) => setValue(name, e.target.value, { shouldDirty: true })}
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
            chrome="full"
            variant={spec.variant ?? "inline"}
            value={value}
            onChange={(next) => setValue(name, next, { shouldDirty: true })}
            manifest={manifest}
            placeholder={spec.label}
            allowFontFamily={blockType === "richText"}
          />
        </div>
      </div>
    )
  }
  if (spec.kind === "cta") {
    const cta = (value ?? {}) as { label?: string; href?: string }
    return (
      <div className="space-y-3 pb-4" data-mobile-editor-kind="cta">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("label")}</Label>
          <Input
            value={cta.label ?? ""}
            onChange={(e) => setValue(name, { ...cta, label: e.target.value }, { shouldDirty: true })}
            placeholder={t("buttonText")}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{tCommon("url")}</Label>
          <Input
            value={cta.href ?? ""}
            onChange={(e) => setValue(name, { ...cta, href: e.target.value }, { shouldDirty: true })}
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
        <Select value={value ?? ""} onValueChange={(next) => setValue(name, next, { shouldDirty: true })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={spec.label} />
          </SelectTrigger>
          <SelectContent data-siab-editor-ui data-siab-canvas-chrome="mobile-field-select">
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
          onCheckedChange={(checked) => setValue(name, checked === true, { shouldDirty: true })}
        />
        <span>{spec.label}</span>
      </label>
    )
  }
  if (spec.kind === "image") {
    return <ImageEditor value={value} setValue={setValue} name={name} expandTo={expandTo} />
  }
  if (spec.kind === "icon") {
    return <IconEditor value={value} setValue={setValue} name={name} expandTo={expandTo} />
  }
  if (spec.kind === "array") {
    const arrayName = `blocks.${path.blockIndex}.${spec.field}`
    return (
      <MobileArrayDrilldown
        spec={spec}
        blockIndex={path.blockIndex}
        manifest={manifest}
        arrayName={arrayName}
      />
    )
  }
  return <p className="text-xs text-muted-foreground">{t("unknownFieldKind", { kind: spec.kind })}</p>
}

const resolveUrl = (v: any): string | null => {
  if (!v) return null
  if (typeof v === "string") return v
  if (typeof v === "object") {
    if (v.url) return v.url
    if (v.filename) return `/media/${v.filename}`
  }
  return null
}

const ImageEditor: React.FC<{
  value: any
  setValue: (name: string, val: any, opts?: { shouldDirty?: boolean }) => void
  name: string
  expandTo: (snap: MobileSnap) => void
}> = ({ value, setValue, name, expandTo }) => {
  const t = useTranslations("editor")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const url = resolveUrl(value)
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
            onClick={() => setValue(name, null, { shouldDirty: true })}
          >
            {t("remove")}
          </Button>
        )}
      </div>
      <MobileMediaSheet
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) expandTo(0.42) }}
        onPick={(m) => setValue(name, m, { shouldDirty: true })}
      />
    </div>
  )
}

const IconEditor: React.FC<{
  value: any
  setValue: (name: string, val: any, opts?: { shouldDirty?: boolean }) => void
  name: string
  expandTo: (snap: MobileSnap) => void
}> = ({ value, setValue, name, expandTo }) => {
  const t = useTranslations("editor")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const iconName: string | null = value ?? null
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
        onChange={(next) => setValue(name, next, { shouldDirty: true })}
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

function inspectorFontDeclarations(theme: ThemeTokens | null | undefined): string {
  const resolved = resolveThemeTokens(theme)
  const title = formatRuntimeCssValue(resolved.fonts.roles.display ?? resolved.fonts.roles.heading) ?? "var(--rt-tenant-font-title, inherit)"
  const heading = formatRuntimeCssValue(resolved.fonts.roles.heading) ?? "var(--rt-tenant-font-heading, inherit)"
  const text = formatRuntimeCssValue(resolved.fonts.roles.body) ?? "var(--rt-tenant-font-text, inherit)"
  return `--rt-inspector-font-title:${title};--rt-inspector-font-heading:${heading};--rt-inspector-font-text:${text};`
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

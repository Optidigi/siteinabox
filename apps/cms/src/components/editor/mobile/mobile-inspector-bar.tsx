"use client"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { Drawer as Vaul } from "vaul"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import {
  MOBILE_INSPECTOR_COLLAPSED_SNAP,
  useMobileEditor,
  type MobileSnap,
} from "@/components/editor/mobile/MobileEditorContext"
import { useInspectorKeyboardLock } from "@/components/editor/mobile/useInspectorKeyboardLock"
import { getBlockElementSpecs, type ElementSpec } from "@/components/editor/blockElements"
import { elementPathToName } from "@/components/editor/elementPath"
import { MobileComponentEditor } from "@/components/editor/mobile/mobile-component-editor"
import { MobileMediaSheet } from "@/components/editor/mobile/mobile-media-sheet"
import { BlockFormFields } from "@/components/editor/fields/block-form-fields"
import { VAUL_BOTTOM_SNAP_CSS } from "@/components/editor/mobile/vaulBottomSnapCss"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useTranslations } from "next-intl"

export interface MobileInspectorBarProps {
  /** Block currently displayed in the section view — passed to MobileComponentEditor. */
  block: any
  blockIndex: number
  manifest: RtManifest
  /** Used ONLY to extract font family overrides for editor content; the drawer chrome itself still inherits admin tokens. */
  theme?: ThemeTokens | null
  renderInspector?: (context: MobileInspectorBarSlotContext) => React.ReactNode
}

export interface MobileInspectorBarSlotContext {
  isIdle: boolean
  snapFraction: number
  pathKey: string
  handle: React.ReactNode
  editor: React.ReactNode
  body: React.ReactNode
}

export interface MobileInspectorBarLayoutProps {
  snapFraction: number
  handle: React.ReactNode
  body: React.ReactNode
}

const SNAP_POINTS: MobileSnap[] = [MOBILE_INSPECTOR_COLLAPSED_SNAP, 0.42, 0.92]
const isMobileSnap = (snap: unknown): snap is MobileSnap => snap === MOBILE_INSPECTOR_COLLAPSED_SNAP || snap === 0.42 || snap === 0.92

/**
 * Bottom inspector bar driven by vaul.
 *
 * Snap points: [0.08, 0.42, 0.92]
 *   0.08 — collapsed detent; only the handle remains visible.
 *   0.42 — compact detent; the sheet opens here on selection — a canvas
 *          sliver stays visible.
 *   0.92 — editing detent; focusing a field pops the sheet here (animated)
 *          so the field clears the keyboard. When focus leaves the inspector
 *          field or the keyboard closes, the sheet restores to its pre-focus
 *          detent unless the user manually changed detents.
 *
 * Idle state (selected null + drillStack empty) stays mounted at the collapsed
 * handle snap so opening a focused section does not immediately cover the
 * canvas. Dragging/clicking the handle opens the block-level inspector.
 *
 * vaul config:
 *   open={true}          — always mounted so the collapsed handle remains
 *                          available in focused section view
 *   dismissible={false}  — dragging down lands on the collapsed snap instead
 *                          of fully closing the controlled drawer
 *   modal={false}        — canvas stays interactive
 *   noBodyStyles={true}  — PageForm uses document scroll
 *   repositionInputs={false} — vaul's own keyboard handler mis-positions the
 *                          sheet at snap index 0 (it guards on a falsy
 *                          activeSnapPointIndex), so it stays disabled. iOS's
 *                          native focus-scroll is suppressed by
 *                          useInspectorKeyboardLock instead (FE-71).
 *   handleOnly={true}    — only the visible grip drags the sheet; controls in
 *                          the editor body keep normal tap/click behavior.
 */
export const MobileInspectorBar: React.FC<MobileInspectorBarProps> = ({ block, blockIndex, manifest, theme, renderInspector }) => {
  const t = useTranslations("editor")
  const cspNonce = useCspNonce()
  const { state, setSelected, expandTo, clearSelection, restorePreFocusSnap } = useMobileEditor()
  const { setValue } = useFormContext()
  const isIdle = state.selected == null && state.drillStack.length === 0
  const selectedSpec = state.selected
    ? resolveSelectedSpec(block?.blockType, manifest, state.selected.field, state.selected.subField)
    : undefined
  const isBlockSelection = state.selected?.field === ""
  const selectedName = state.selected && !isBlockSelection ? elementPathToName(state.selected) : null
  const isDirectMediaSelection = state.selected != null && selectedName != null && selectedSpec?.kind === "image"
  const pathKey = state.selected
    ? `${state.selected.blockIndex}.${state.selected.field}.${state.selected.itemIndex ?? ""}.${state.selected.subField ?? ""}`
    : "idle"

  // Visible snap fraction — the scroll region below is capped to it so content
  // taller than the active detent stays clipped to the visible sheet (FE-60).
  const snapFraction = typeof state.activeSnapPoint === "number" ? state.activeSnapPoint : MOBILE_INSPECTOR_COLLAPSED_SNAP
  const snapClass = snapFraction >= 0.9
    ? "max-h-[calc(92svh-1rem)]"
    : snapFraction <= MOBILE_INSPECTOR_COLLAPSED_SNAP
      ? "max-h-0 py-0"
    : "max-h-[calc(42svh-1rem)]"

  // iOS Safari only: suppress the native focus-scroll that would otherwise drag
  // this position:fixed sheet off-screen when a field is focused (FE-71).
  useInspectorKeyboardLock(!isIdle && !isDirectMediaSelection)

  React.useEffect(() => {
    if (isIdle || isDirectMediaSelection) return
    const inspector = document.querySelector("[data-mobile-inspector-bar]")

    const onFocusOut = (event: Event) => {
      const next = (event as FocusEvent).relatedTarget as HTMLElement | null
      if (next?.closest("input,textarea,[contenteditable]")) return
      restorePreFocusSnap()
    }
    inspector?.addEventListener("focusout", onFocusOut)

    const viewport = window.visualViewport
    let keyboardOpen = viewport ? window.innerHeight - viewport.height > 120 : false
    const onViewportResize = () => {
      if (!viewport) return
      const nextKeyboardOpen = window.innerHeight - viewport.height > 120
      if (keyboardOpen && !nextKeyboardOpen) restorePreFocusSnap()
      keyboardOpen = nextKeyboardOpen
    }
    viewport?.addEventListener("resize", onViewportResize)

    return () => {
      inspector?.removeEventListener("focusout", onFocusOut)
      viewport?.removeEventListener("resize", onViewportResize)
    }
  }, [isDirectMediaSelection, isIdle, restorePreFocusSnap])

  if (isDirectMediaSelection) {
    return (
      <MobileMediaSheet
        open
        onOpenChange={(open) => { if (!open) clearSelection() }}
        onPick={(media) => {
          setValue(selectedName, media, { shouldDirty: true })
          clearSelection()
        }}
      />
    )
  }

  const handle = (
    <Vaul.Handle
      data-mobile-inspector-grip
      preventCycle
      className="mt-2 shrink-0 !bg-muted-foreground/30"
      onClick={() => {
        if (!isIdle) return
        setSelected({ blockIndex, field: "" })
      }}
    />
  )
  const editor = state.selected ? (
    <div
      key={pathKey}
      className="h-full animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {isBlockSelection ? (
        <BlockFormFields
          block={block}
          blockIndex={state.selected.blockIndex}
          manifest={manifest}
          theme={theme}
        />
      ) : (
        <MobileComponentEditor
          path={state.selected}
          block={block}
          manifest={manifest}
          theme={theme}
        />
      )}
    </div>
  ) : null
  const body = (
    <div
      className={`flex-1 min-h-0 overflow-hidden px-4 py-3 ${snapClass}`}
    >
      {editor}
    </div>
  )
  const content = renderInspector
    ? renderInspector({ isIdle, snapFraction, pathKey, handle, editor, body })
    : (
      <MobileInspectorBarLayout
        snapFraction={snapFraction}
        handle={handle}
        body={body}
      />
    )

  return (
    <Vaul.Root
      open
      dismissible={false}
      modal={false}
      noBodyStyles
      repositionInputs={false}
      handleOnly
      snapPoints={SNAP_POINTS}
      activeSnapPoint={state.activeSnapPoint}
      setActiveSnapPoint={(snap) => {
        if (!isMobileSnap(snap)) return
        if (snap === MOBILE_INSPECTOR_COLLAPSED_SNAP) {
          clearSelection()
          return
        }
        if (isIdle) setSelected({ blockIndex, field: "" })
        expandTo(snap)
      }}
      onOpenChange={(open) => { if (!open) clearSelection() }}
    >
      <Vaul.Portal>
        <style
          nonce={cspNonce}
          suppressHydrationWarning
          data-mobile-inspector-vaul-css
          dangerouslySetInnerHTML={{ __html: VAUL_BOTTOM_SNAP_CSS }}
        />
        <Vaul.Content
          data-mobile-inspector-bar
          data-siab-editor-ui
          aria-label={t("sectionInspector")}
          className="fixed inset-x-0 top-0 z-50 flex h-[100svh] flex-col overscroll-contain rounded-t-[10px] border-t border-border bg-background outline-none pointer-events-none"
        >
          <Vaul.Title className="sr-only">{t("sectionInspector")}</Vaul.Title>
          {content}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  )
}

export const MobileInspectorBarLayout: React.FC<MobileInspectorBarLayoutProps> = ({
  handle,
  body,
}) => (
  <div className="pointer-events-auto flex h-full flex-col overscroll-contain">
    {/* Drag handle. The sheet uses handleOnly so editor controls stay tappable. */}
    {handle}
    {body}
  </div>
)

function resolveSelectedSpec(
  blockType: string | undefined,
  manifest: RtManifest,
  field: string,
  subField?: string,
): ElementSpec | undefined {
  const specs = getBlockElementSpecs(blockType, manifest)
  const parentSpec = specs.find((s) => s.field === field)
  if (parentSpec?.kind === "array" && subField) {
    return parentSpec.itemFields?.find((s) => s.field === subField)
  }
  return parentSpec
}

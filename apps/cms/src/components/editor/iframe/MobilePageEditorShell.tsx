"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ArrowLeft, Eye, Pencil, Sparkles } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import { SaveButton, type SaveButtonProps } from "@/components/save-ui/save-button"
import { useEditorMobilePager, type EditorMobilePane } from "@/components/editor/iframe/useEditorMobilePager"
import type { ElementPath } from "@/components/editor/elementPath"

export function MobilePageEditorShell({
  preview,
  inspector,
  agent,
  onExit,
  save,
  selected,
}: {
  preview: ReactNode
  inspector: ReactNode
  agent: ReactNode
  onExit: () => void
  save: SaveButtonProps
  selected: ElementPath | null
}) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { pagerRef, pane, paging, scrollToPane } = useEditorMobilePager("preview")
  const previewInteractive = pane === "preview" && !paging
  const selectionKey = selected
    ? `${selected.blockIndex}.${selected.field}.${selected.itemIndex ?? ""}.${selected.subField ?? ""}`
    : ""
  const previousSelectionKey = useRef(selectionKey)

  useEffect(() => {
    const changed = selectionKey !== "" && selectionKey !== previousSelectionKey.current
    previousSelectionKey.current = selectionKey
    if (changed && pane === "preview") scrollToPane("inspector")
  }, [pane, selectionKey, scrollToPane])

  return (
    <div
      data-siab-mobile-page-editor
      className="-mx-4 -mt-4 -mb-4 flex h-[calc(100dvh-4rem)] min-h-0 flex-col md:-mx-6 md:-mt-6 md:-mb-6"
    >
      <div
        ref={pagerRef}
        data-siab-editor-pager
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        <section
          className="flex h-full w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden"
          aria-label={t("agentPane")}
          aria-hidden={pane !== "agent"}
        >
          {agent}
        </section>
        <section
          className="flex h-full w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden bg-muted"
          aria-label={t("previewPane")}
          aria-hidden={pane !== "preview"}
        >
          <div className={cn("flex min-h-0 flex-1 flex-col", !previewInteractive && "pointer-events-none")}>
            {preview}
          </div>
        </section>
        <section
          className="flex h-full w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden bg-card"
          aria-label={t("inspectorPane")}
          aria-hidden={pane !== "inspector"}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inspector}
          </div>
        </section>
      </div>

      <div
        data-mobile-page-editor-bar
        className="flex shrink-0 items-center gap-2 border-t-2 border-border bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      >
        <Button type="button" variant="outline" size="icon" aria-label={t("exitEditor")} onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="default"
          size="icon"
          aria-label={t("agentPane")}
          aria-pressed={pane === "agent"}
          onClick={() => scrollToPane("agent")}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={pane === "preview" ? "default" : "outline"}
          size="icon"
          aria-label={t("previewPane")}
          aria-pressed={pane === "preview"}
          onClick={() => scrollToPane("preview")}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={pane === "inspector" ? "default" : "outline"}
          size="icon"
          aria-label={tCommon("edit")}
          aria-pressed={pane === "inspector"}
          onClick={() => scrollToPane("inspector")}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <div className="ml-auto">
          <SaveButton {...save} />
        </div>
      </div>
    </div>
  )
}

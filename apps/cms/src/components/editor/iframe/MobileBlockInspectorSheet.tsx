"use client"

import * as React from "react"
import { Check, Trash2 } from "lucide-react"
import { Drawer as Vaul } from "vaul"
import { Button } from "@siteinabox/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { blockBySlug } from "@/blocks/registry"
import { BlockFormFields } from "@/components/editor/fields/block-form-fields"
import { VAUL_BOTTOM_SNAP_CSS } from "@/components/editor/canvas/mobile/vaulBottomSnapCss"
import { useInspectorKeyboardLock } from "@/components/editor/canvas/mobile/useInspectorKeyboardLock"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { useTranslations } from "next-intl"

const BLOCK_INSPECTOR_SNAP = 0.92

export interface MobileBlockInspectorSheetProps {
  blockIndex: number
  block: Record<string, unknown>
  manifest: RtManifest
  theme?: ThemeTokens | null
  onClose: () => void
  onDeleteBlock: (index: number) => void
}

/**
 * Parent-owned mobile block inspector for the iframe page editor. Opens when the
 * frame requests `edit.start` with `mode: "settings"`; hosts full
 * `BlockFormFields` + delete in the parent document (iframe owns the canvas).
 */
export function MobileBlockInspectorSheet({
  blockIndex,
  block,
  manifest,
  theme,
  onClose,
  onDeleteBlock,
}: MobileBlockInspectorSheetProps) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const cspNonce = useCspNonce()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const cfg = blockBySlug[String(block.blockType)]
  const label = cfg
    ? (typeof cfg.labels?.singular === "string" ? cfg.labels.singular : cfg.slug)
    : String(block.blockType ?? t("block"))

  useInspectorKeyboardLock(true)

  return (
    <>
      <Vaul.Root
        open
        dismissible
        modal={false}
        noBodyStyles
        repositionInputs={false}
        handleOnly
        snapPoints={[BLOCK_INSPECTOR_SNAP]}
        activeSnapPoint={BLOCK_INSPECTOR_SNAP}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose()
        }}
      >
        <Vaul.Portal>
          <style
            nonce={cspNonce}
            suppressHydrationWarning
            data-mobile-inspector-vaul-css
            dangerouslySetInnerHTML={{ __html: VAUL_BOTTOM_SNAP_CSS }}
          />
          <Vaul.Content
            data-mobile-frame-block-inspector
            aria-label={t("sectionInspector")}
            className="fixed inset-x-0 top-0 z-50 flex h-[100svh] flex-col overscroll-contain rounded-t-[10px] border-t border-border bg-background outline-none pointer-events-none"
          >
            <Vaul.Title className="sr-only">{t("sectionInspector")}</Vaul.Title>
            <div className="pointer-events-auto flex h-full flex-col overscroll-contain">
              <Vaul.Handle
                data-mobile-inspector-grip
                preventCycle
                className="mt-2 shrink-0 !bg-muted-foreground/30"
              />
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <Vaul.Close asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-10 shrink-0 rounded-full"
                    aria-label={tCommon("done")}
                    data-mobile-frame-block-inspector-done
                  >
                    <Check className="size-4" aria-hidden />
                  </Button>
                </Vaul.Close>
                <div className="min-w-0 flex-1 text-center text-sm font-medium truncate">{label}</div>
                <span className="size-10 shrink-0" aria-hidden />
              </header>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <BlockFormFields
                  block={block}
                  blockIndex={blockIndex}
                  manifest={manifest}
                  theme={theme}
                />
              </div>
              <footer className="border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="w-full gap-1.5"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("deleteBlock")}
                </Button>
              </footer>
            </div>
          </Vaul.Content>
        </Vaul.Portal>
      </Vaul.Root>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteBlockTitle")}
        description={t("deleteBlockDescription", { label })}
        confirmLabel={t("deleteBlock")}
        variant="destructive"
        onConfirm={async () => {
          onDeleteBlock(blockIndex)
        }}
      />
    </>
  )
}

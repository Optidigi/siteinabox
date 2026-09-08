"use client"

import { Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@siteinabox/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@siteinabox/ui/components/sheet"
import { BuilderLogo } from "@/components/builder/BuilderLogo"
import { CmsAgentPanel } from "./CmsAgentPanel"
import type { SiteEditorSnapshot } from "@/lib/agent/tools"

export function CmsAgentDrawer({
  tenantSlug,
  pageSlug,
  selectedBlockIndex,
  onApplied,
}: {
  tenantSlug: string
  pageSlug?: string | null
  selectedBlockIndex?: number | null
  onApplied?: (snapshot: SiteEditorSnapshot) => void
}) {
  const t = useTranslations("common")

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Site agent">
          <Sparkles className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 bg-background p-0 sm:max-w-[32rem]"
      >
        <SheetTitle className="sr-only">Site agent</SheetTitle>
        <header className="flex w-full shrink-0 items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center">
            <BuilderLogo imgClassName="h-8 max-w-[11rem] sm:h-9 sm:max-w-[14rem]" />
          </div>
          <SheetClose asChild>
            <Button type="button" variant="outline" size="icon" aria-label={t("close")}>
              <X className="size-4" />
            </Button>
          </SheetClose>
        </header>
        <CmsAgentPanel
          tenantSlug={tenantSlug}
          pageSlug={pageSlug}
          selectedBlockIndex={selectedBlockIndex}
          onApplied={onApplied}
        />
      </SheetContent>
    </Sheet>
  )
}

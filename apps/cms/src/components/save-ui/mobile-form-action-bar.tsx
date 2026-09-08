"use client"

import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@siteinabox/ui/components/button"
import { SaveButton, type SaveButtonProps } from "@/components/save-ui/save-button"

type Props = {
  onBack: () => void
  save?: SaveButtonProps | null
}

/**
 * Phone-only thumb-zone bar for operator forms (nav, settings, user, tenant).
 * Page editor and section editor keep their floating pills until that chrome
 * is refactored.
 */
export function MobileFormActionBar({ onBack, save }: Props) {
  const t = useTranslations("common")

  return (
    <>
      <div aria-hidden className="h-[calc(4.75rem+env(safe-area-inset-bottom,0px))] shrink-0 md:hidden" />
      <div
        data-mobile-form-action-bar
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t-2 border-border bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:hidden"
      >
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Button>
        {save ? <SaveButton {...save} /> : null}
      </div>
    </>
  )
}

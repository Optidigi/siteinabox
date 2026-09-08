"use client"
import * as React from "react"
import { X } from "lucide-react"
import { MobileFloatingPill, type MobileFloatingPillPosition } from "@/components/common/mobile-floating-pill"
import { useTranslations } from "next-intl"

export interface MobileBackPillProps {
  onBack: () => void
  /** Corner to anchor to. Defaults to top-left (the page/section editor's
   *  position); pass "top-right" + an `offset` to sit it beside a save pill. */
  position?: MobileFloatingPillPosition
  /** Horizontal inset (CSS length), e.g. to clear an adjacent pill that
   *  shares the same corner. */
  offset?: string
}

/**
 * Floating back/close pill for mobile sub-views. Mirrors MobileSavePill's
 * MobileFloatingPill base — same size, same default inverted colour.
 *
 * Top-left by default (the page/section editor's placement — pinned until
 * that chrome is refactored). Operator forms use `MobileFormActionBar`.
 */
export const MobileBackPill: React.FC<MobileBackPillProps> = ({
  onBack,
  position = "top-left",
  offset,
}) => {
  const t = useTranslations("common")
  return (
    <MobileFloatingPill
      position={position}
      offset={offset}
      icon={<X className="h-5 w-5" aria-hidden />}
      onClick={onBack}
      ariaLabel={t("close")}
      variant="default"
      dataAttrs={{ "data-mobile-back-pill": "" }}
    />
  )
}

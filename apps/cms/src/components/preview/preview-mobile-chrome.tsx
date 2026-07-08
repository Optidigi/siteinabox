"use client"

import * as React from "react"
import { CheckCircle2, Rocket, SquarePen } from "lucide-react"
import { MobileFloatingPill } from "@/components/common/mobile-floating-pill"
import { PreviewMobileThemeBar } from "@/components/preview/preview-mobile-theme-bar"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useTranslations } from "next-intl"

function PreviewMobileNavPills({
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
  canCompleteOrder: boolean
  paymentSatisfied: boolean
  checkoutHref: string
  reviewHref: string
  customerNavigationBlocked: boolean
}) {
  const t = useTranslations("preview")

  return (
    <>
      <MobileFloatingPill
        position="top-left"
        icon={<SquarePen className="h-5 w-5" aria-hidden />}
        href={customerNavigationBlocked ? undefined : reviewHref}
        ariaLabel={t("reviewChanges")}
        variant="default"
        disabled={customerNavigationBlocked}
        dataAttrs={{ "data-mobile-preview-review": "" }}
      />

      {canCompleteOrder ? (
        <MobileFloatingPill
          position="top-right"
          icon={<Rocket className="h-5 w-5" aria-hidden />}
          href={customerNavigationBlocked ? undefined : checkoutHref}
          ariaLabel={t("launchWebsite")}
          variant="success"
          disabled={customerNavigationBlocked}
          dataAttrs={{ "data-mobile-preview-launch": "" }}
        />
      ) : paymentSatisfied ? (
        <MobileFloatingPill
          position="top-right"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          ariaLabel={t("paymentComplete")}
          variant="default"
          disabled
          dataAttrs={{ "data-mobile-preview-payment-complete": "" }}
        />
      ) : null}
    </>
  )
}

export function PreviewMobileChrome({
  theme,
  onThemeChange,
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  canCompleteOrder: boolean
  paymentSatisfied: boolean
  checkoutHref: string
  reviewHref: string
  customerNavigationBlocked: boolean
}) {
  return (
    <div className="md:hidden">
      <PreviewMobileNavPills
        canCompleteOrder={canCompleteOrder}
        paymentSatisfied={paymentSatisfied}
        checkoutHref={checkoutHref}
        reviewHref={reviewHref}
        customerNavigationBlocked={customerNavigationBlocked}
      />
      <PreviewMobileThemeBar theme={theme} onThemeChange={onThemeChange} />
    </div>
  )
}

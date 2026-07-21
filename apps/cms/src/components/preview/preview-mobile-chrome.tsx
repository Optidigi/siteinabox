"use client"

import * as React from "react"
import { CheckCircle2, Rocket, SquarePen } from "lucide-react"
import { MobileFloatingPill } from "@/components/common/mobile-floating-pill"
import { PreviewMobileThemeBar } from "@/components/preview/preview-mobile-theme-bar"
import {
  PREVIEW_MOBILE_CHROME_CONTROL_SIZE,
  previewMobileChromeWrapperClass,
} from "@/components/preview/preview-mobile-chrome-tone"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useSystemPrefersDark } from "@/lib/theme/use-system-prefers-dark"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

function PreviewMobileNavPills({
  theme,
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
  theme: ThemeTokens | null
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
        surface="theme"
        sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
        icon={<SquarePen className="h-5 w-5" aria-hidden />}
        href={customerNavigationBlocked ? undefined : reviewHref}
        ariaLabel={t("reviewChanges")}
        variant="default"
        disabled={customerNavigationBlocked}
        dataAttrs={{ "data-mobile-preview-review": "" }}
        contrastBorder
      />

      {canCompleteOrder ? (
        <MobileFloatingPill
          position="top-right"
          surface="theme"
          sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
          icon={<Rocket className="h-5 w-5" aria-hidden />}
          href={customerNavigationBlocked ? undefined : checkoutHref}
          ariaLabel={t("launchWebsite")}
          variant="success"
          disabled={customerNavigationBlocked}
          dataAttrs={{ "data-mobile-preview-launch": "" }}
          contrastBorder
        />
      ) : paymentSatisfied ? (
        <MobileFloatingPill
          position="top-right"
          surface="theme"
          sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          ariaLabel={t("paymentComplete")}
          variant="default"
          disabled
          dataAttrs={{ "data-mobile-preview-payment-complete": "" }}
          contrastBorder
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
  const systemPrefersDark = useSystemPrefersDark()
  return (
    <div className={cn("md:hidden", previewMobileChromeWrapperClass(theme, systemPrefersDark))}>
      <PreviewMobileNavPills
        theme={theme}
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

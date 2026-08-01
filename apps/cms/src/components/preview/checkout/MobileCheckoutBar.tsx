"use client"

import { ChevronUp, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@siteinabox/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@siteinabox/ui/components/sheet"

import type { CheckoutQuoteSet } from "@/lib/checkout/checkoutQuote"
import { CheckoutPrimaryActionButton, type CheckoutPrimaryActionHandlers } from "./CheckoutPrimaryAction"
import type { CheckoutDecision, CheckoutPrimaryAction } from "./checkoutPresentation"

export function MobileCheckoutBar({
  decision,
  action,
  selectedDomain,
  dueNow,
  plan,
  quote,
  locale,
  navigationLocked,
  previewHref,
  handlers,
}: {
  decision: CheckoutDecision
  action: CheckoutPrimaryAction
  selectedDomain: string | null
  dueNow: string
  plan: string
  quote?: CheckoutQuoteSet["annual"]["quote"] | null
  locale: string
  navigationLocked: boolean
  previewHref: string
  handlers: CheckoutPrimaryActionHandlers
}) {
  const t = useTranslations("preview")
  const secondary = navigationLocked && decision !== "domain" ? null : decision === "domain" ? (
    <Button asChild variant="outline" className="w-11 px-0" aria-label={t("checkoutBackToPreview")}>
      <a href={previewHref}><X className="size-4" aria-hidden /></a>
    </Button>
  ) : null

  return (
    <div data-checkout-action-bar className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2.5 py-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] backdrop-blur min-[880px]:hidden">
      <div className={decision === "domain"
        ? "mx-auto grid min-h-14 w-full max-w-[65rem] min-w-0 grid-cols-[auto_minmax(0,0.72fr)_minmax(9.75rem,1.28fr)] items-center gap-2"
        : "mx-auto grid min-h-14 w-full max-w-[65rem] min-w-0 grid-cols-[minmax(0,0.72fr)_minmax(9.75rem,1.28fr)] items-center gap-2"}>
        {secondary}
        <span className="min-w-0 leading-tight">
          <span className="block text-[0.5625rem] text-muted-foreground">
            {decision === "review" ? t("checkoutSummaryDueNow") : t("checkoutSummaryDomain")}
          </span>
          <strong className="block truncate text-xs">{decision === "review" ? dueNow : selectedDomain || "—"}</strong>
          {decision === "review" && quote && <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="mt-0.5 inline-flex min-h-6 items-center gap-0.5 text-[0.625rem] font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                {t("checkoutMobileBreakdownAction")}<ChevronUp className="size-3" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto rounded-t-lg pb-[max(env(safe-area-inset-bottom),1rem)]">
              <SheetHeader>
                <SheetTitle>{t("checkoutCompactSummaryTitle")}</SheetTitle>
                <SheetDescription>{t("checkoutMobileBreakdownDescription")}</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 px-4 pb-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryDomain")}</dt><dd className="text-right font-medium [overflow-wrap:anywhere]">{selectedDomain || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutPlanLegend")}</dt><dd className="text-right font-medium">{plan}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryVat")}</dt><dd className="font-medium tabular-nums">{new Intl.NumberFormat(locale, { style: "currency", currency: quote.currency }).format(quote.vatAmountMinor / 100)}</dd></div>
                <div className="flex justify-between gap-4 border-t pt-3"><dt className="font-medium">{t("checkoutSummaryDueNow")}</dt><dd className="font-semibold tabular-nums">{dueNow}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryFutureSubscription")}</dt><dd className="font-medium tabular-nums">{new Intl.NumberFormat(locale, { style: "currency", currency: quote.currency }).format(quote.futureSubscriptionGrossMinor / 100)}</dd></div>
              </dl>
            </SheetContent>
          </Sheet>}
        </span>
        <span className="flex min-w-0 [&>button]:h-auto [&>button]:min-h-11 [&>button]:w-full [&>button]:text-xs [&>button]:leading-tight">
          <CheckoutPrimaryActionButton action={action} dueNow={dueNow} handlers={handlers} />
        </span>
      </div>
    </div>
  )
}

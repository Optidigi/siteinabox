"use client"

import { ChevronUp } from "lucide-react"
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
  const money = (minor: number) => new Intl.NumberFormat(locale, { style: "currency", currency: quote?.currency ?? "EUR" }).format(minor / 100)
  void navigationLocked
  void previewHref

  return (
    <div data-checkout-action-bar className="fixed inset-x-0 bottom-0 z-40 flex min-h-[72px] items-center border-t bg-card/95 px-[10px] py-2.5 pb-[max(env(safe-area-inset-bottom),0.625rem)] shadow-2xl backdrop-blur-xl min-[560px]:px-[14px] min-[880px]:hidden">
      <div className={decision === "domain"
        ? "mx-auto flex min-h-12 w-full max-w-[65rem] min-w-0 items-center gap-2"
        : "mx-auto flex min-h-12 w-full max-w-[65rem] min-w-0 items-center gap-3"}>
        <span className="min-w-0 flex-1 text-left leading-tight">
          <strong className="block truncate text-sm font-bold tabular-nums">{decision === "review" ? dueNow : selectedDomain || "—"}</strong>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {decision === "review" ? t("checkoutSummaryDueNowInclVat") : t("checkoutSummaryDomain")}
          </span>
          {decision === "review" && quote && <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="link" className="mt-1 h-auto min-h-8 gap-1 px-0 py-1 text-xs font-medium text-foreground underline-offset-2 hover:text-foreground/80">
                {t("checkoutMobileBreakdownAction")}<ChevronUp className="size-3.5 shrink-0" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto rounded-t-lg pb-[max(env(safe-area-inset-bottom),1rem)]">
              <SheetHeader>
                <SheetTitle>{t("checkoutCompactSummaryTitle")}</SheetTitle>
                <SheetDescription>{t("checkoutMobileBreakdownDescription")}</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 px-4 pb-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryDomain")}</dt><dd className="text-right font-medium [overflow-wrap:anywhere]">{selectedDomain || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{plan} · {t("checkoutPriceExVat")}</dt><dd className="font-medium tabular-nums">{money(quote.planPriceNetMinor)}</dd></div>
                {quote.domainSurchargeNetMinor > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryDomainExtraExVat")}</dt><dd className="font-medium tabular-nums">{money(quote.domainSurchargeNetMinor)}</dd></div>}
                {quote.migrationServiceFeeNetMinor > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryMigrationExVat")}</dt><dd className="font-medium tabular-nums">{money(quote.migrationServiceFeeNetMinor)}</dd></div>}
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryVat")}</dt><dd className="font-medium tabular-nums">{money(quote.vatAmountMinor)}</dd></div>
                <div className="flex justify-between gap-4 border-t pt-3"><dt className="font-medium">{t("checkoutSummaryDueNowInclVat")}</dt><dd className="font-semibold tabular-nums">{dueNow}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("checkoutSummaryFutureSubscription")}</dt><dd className="font-medium tabular-nums">{money(quote.futureSubscriptionGrossMinor)}</dd></div>
              </dl>
            </SheetContent>
          </Sheet>}
        </span>
        <span className="flex min-w-0 max-w-[52%] shrink-0 [&>button]:h-auto [&>button]:min-h-12 [&>button]:px-3 [&>button]:text-xs [&>button]:leading-snug min-[375px]:[&>button]:px-4">
          <CheckoutPrimaryActionButton action={action} dueNow={dueNow} handlers={handlers} compact />
        </span>
      </div>
    </div>
  )
}

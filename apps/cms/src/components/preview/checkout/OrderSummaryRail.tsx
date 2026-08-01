"use client"

import { ReceiptText, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Separator } from "@siteinabox/ui/components/separator"
import { cn } from "@siteinabox/ui/lib/utils"

import type { CheckoutQuoteSet } from "@/lib/checkout/checkoutQuote"
import { CheckoutPrimaryActionButton, type CheckoutPrimaryActionHandlers } from "./CheckoutPrimaryAction"
import type { CheckoutPrimaryAction } from "./checkoutPresentation"

type BillingPeriod = "monthly" | "annual"

const money = (locale: string, minor: number, currency: string): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100)

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="min-w-0 text-xs leading-snug text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 [overflow-wrap:anywhere] text-right text-sm leading-snug tabular-nums", strong ? "font-semibold" : "font-medium")}>
        {value || "—"}
      </span>
    </div>
  )
}

export function OrderSummaryRail({
  domain,
  company,
  plan,
  dueNow,
  quote,
  locale,
  primaryAction,
  handlers,
}: {
  domain: string
  company: string
  plan: string
  dueNow: string
  quote?: CheckoutQuoteSet[BillingPeriod]["quote"] | null
  locale: string
  primaryAction: CheckoutPrimaryAction
  handlers: CheckoutPrimaryActionHandlers
}) {
  const t = useTranslations("preview")
  const vatRate = quote ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(quote.vatRateBasisPoints / 10_000) : null
  return (
    <Card data-checkout-summary className="hidden gap-0 overflow-hidden py-0 shadow-xs min-[880px]:sticky min-[880px]:top-20 min-[880px]:block">
      <CardHeader className="gap-1 border-b bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md border bg-muted/50"><ReceiptText className="size-4" aria-hidden /></span>
          <CardTitle className="text-sm">{t("checkoutCompactSummaryTitle")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2.5 p-3">
        <SummaryRow label={t("checkoutSummaryDomain")} value={domain} />
        <SummaryRow label={t("checkoutContractingParty")} value={company} />
        <SummaryRow label={t("checkoutPlanLegend")} value={plan} />
        {quote && <>
          <SummaryRow label={t("checkoutSummaryProviderDomainExVat")} value={money(locale, quote.providerOperationPriceNetMinor, quote.currency)} />
          {quote.domainSurchargeNetMinor > 0 && <SummaryRow label={t("checkoutSummaryDomainSurchargeExVat")} value={money(locale, quote.domainSurchargeNetMinor, quote.currency)} />}
          <SummaryRow label={t("checkoutSummaryNet")} value={money(locale, quote.netAmountMinor, quote.currency)} />
          <SummaryRow label={t("checkoutSummaryVatRate", { rate: vatRate ?? "" })} value={money(locale, quote.vatAmountMinor, quote.currency)} />
        </>}
        <Separator />
        <SummaryRow label={t("checkoutSummaryDueNow")} value={dueNow} strong />
        {quote && <SummaryRow label={t("checkoutSummaryFutureSubscription")} value={money(locale, quote.futureSubscriptionGrossMinor, quote.currency)} />}
        <div className="grid gap-2 border-t pt-2.5 [&>button]:w-full">
          <CheckoutPrimaryActionButton action={primaryAction} dueNow={dueNow} handlers={handlers} />
          <p className="text-center text-[0.625rem] leading-relaxed text-muted-foreground">{t("checkoutMollieSecurityNote")}</p>
        </div>
        <div className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("checkoutCompactSummarySaved")}</span>
        </div>
      </CardContent>
    </Card>
  )
}

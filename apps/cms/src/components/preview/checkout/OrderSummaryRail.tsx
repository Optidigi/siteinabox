"use client"

import { ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { cn } from "@siteinabox/ui/lib/utils"

import type { CheckoutQuoteSet } from "@/lib/checkout/checkoutQuote"
import { CheckoutPrimaryActionButton, type CheckoutPrimaryActionHandlers } from "./CheckoutPrimaryAction"
import type { CheckoutPrimaryAction } from "./checkoutPresentation"

type BillingPeriod = "monthly" | "annual"

const money = (locale: string, minor: number, currency: string): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100)

function SummaryRow({ label, value, subtle = false }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-4 text-xs", subtle && "text-[0.6875rem]")}>
      <span className="min-w-0 leading-snug text-zinc-300/75">{label}</span>
      <span className="min-w-0 text-right font-semibold leading-snug tabular-nums text-zinc-50 [overflow-wrap:anywhere]">
        {value || "—"}
      </span>
    </div>
  )
}

export function OrderSummaryRail({
  domain, company, plan, dueNow, quote, locale, primaryAction, handlers,
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
    <aside data-checkout-summary aria-label={t("checkoutCompactSummaryTitle")} className="hidden min-[880px]:sticky min-[880px]:top-20 min-[880px]:block">
      <Card className="gap-0 overflow-hidden rounded-2xl border-white/10 bg-zinc-950 py-0 text-zinc-50 shadow-sm dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-white/10 px-[19px] py-[17px]">
          <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold uppercase tracking-[0.09em] text-zinc-300/65">
            <span>{t("checkoutCompactSummaryTitle")}</span>
            <span className="max-w-[8rem] truncate">{plan}</span>
          </div>
          <CardTitle className="text-base font-bold tracking-[-0.02em] text-zinc-50 [overflow-wrap:anywhere]">{domain || "—"}</CardTitle>
          <p className="truncate text-[0.6875rem] text-zinc-300/65">{company}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-2.5 px-[19px] py-[15px]">
            <SummaryRow label={t("checkoutPlanLegend")} value={plan} />
            {quote && <>
              <SummaryRow label={t("checkoutSummaryProviderDomainExVat")} value={money(locale, quote.providerOperationPriceNetMinor, quote.currency)} />
              {quote.domainSurchargeNetMinor > 0 && <SummaryRow label={t("checkoutSummaryDomainSurchargeExVat")} value={money(locale, quote.domainSurchargeNetMinor, quote.currency)} />}
              <SummaryRow label={t("checkoutSummaryNet")} value={money(locale, quote.netAmountMinor, quote.currency)} />
              <SummaryRow subtle label={t("checkoutSummaryVatRate", { rate: vatRate ?? "" })} value={money(locale, quote.vatAmountMinor, quote.currency)} />
            </>}
          </div>
          <div className="mx-[19px] border-t border-white/15 py-[15px]">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs text-zinc-300/75">{t("checkoutSummaryDueNow")}</span>
              <strong className="text-2xl font-bold leading-none tracking-[-0.035em] tabular-nums">{dueNow}</strong>
            </div>
            {quote && <p className="mt-2 text-[0.625rem] leading-relaxed text-zinc-300/60">{t("checkoutSummaryFutureSubscription")} · {money(locale, quote.futureSubscriptionGrossMinor, quote.currency)}</p>}
          </div>
          {primaryAction.kind !== "wait" && <div className="border-t border-white/5 bg-white/[0.03] px-[19px] pb-[19px] pt-[15px] [&>button]:min-h-[50px] [&>button]:w-full">
            <CheckoutPrimaryActionButton action={primaryAction} dueNow={dueNow} handlers={handlers} />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[0.625rem] leading-relaxed text-zinc-300/60">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />{t("checkoutMollieSecurityNote")}
            </p>
          </div>}
        </CardContent>
      </Card>
      <p className="mx-1 mt-2.5 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("checkoutCompactSummarySaved")}</span>
      </p>
    </aside>
  )
}

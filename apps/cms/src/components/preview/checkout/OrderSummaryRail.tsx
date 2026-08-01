"use client"

import { Info, ShieldCheck } from "lucide-react"
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
  const addressDecision = primaryAction.kind === "check_domain" || primaryAction.kind === "continue_to_review"
  const displayDomain = addressDecision && !quote
    ? t("checkoutDomainUnset")
    : domain || "—"
  // The address decision is committed from the launch sheet itself. Keeping the
  // rail informational until review avoids a competing "check domain" control
  // and matches the launch workspace hierarchy.
  const showsRailAction = primaryAction.kind === "pay" || primaryAction.kind === "complete_details"
  return (
    <aside data-checkout-summary aria-label={t("checkoutCompactSummaryTitle")} className="hidden min-[880px]:sticky min-[880px]:top-[70px] min-[880px]:block">
      <Card className="gap-0 overflow-hidden rounded-[22px] border-white/10 bg-foreground py-0 text-zinc-50 shadow-sm dark:bg-card">
        <CardHeader className="gap-0 border-b border-white/10 px-[19px] pb-[15px] pt-[19px]">
          <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold uppercase tracking-[0.09em] text-zinc-300/65">
            <span>{addressDecision ? t("checkoutLaunchWorkspace") : t("checkoutCompactSummaryTitle")}</span>
            <span className="max-w-[9rem] truncate">{addressDecision ? company : plan}</span>
          </div>
          <CardTitle className="mt-[9px] text-base font-bold tracking-[-0.02em] text-zinc-50 [overflow-wrap:anywhere]">{displayDomain}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-[10px] px-[19px] py-[15px]">
            {addressDecision ? <>
              <SummaryRow label={`${plan} · ${t("checkoutPriceExVat")}`} value={quote ? money(locale, quote.planPriceNetMinor, quote.currency) : "—"} />
              <SummaryRow label={t("checkoutSummaryDomain")} value={quote ? quote.domainSurchargeNetMinor > 0 ? `${money(locale, quote.domainSurchargeNetMinor, quote.currency)} ${t("checkoutPriceExVat")}` : t("checkoutDomainIncludedBadge") : "—"} />
              <SummaryRow subtle label={t("checkoutSummaryVatRate", { rate: vatRate ?? "" })} value={quote ? money(locale, quote.vatAmountMinor, quote.currency) : "—"} />
            </> : quote && <>
              <SummaryRow label={`${plan} · ${t("checkoutPriceExVat")}`} value={money(locale, quote.planPriceNetMinor, quote.currency)} />
              <SummaryRow label={t("checkoutSummaryDomain")} value={quote.domainSurchargeNetMinor > 0 ? `${money(locale, quote.domainSurchargeNetMinor, quote.currency)} ${t("checkoutPriceExVat")}` : t("checkoutDomainIncludedBadge")} />
              <SummaryRow label={t("checkoutSummaryNet")} value={money(locale, quote.netAmountMinor, quote.currency)} />
              <SummaryRow subtle label={t("checkoutSummaryVatRate", { rate: vatRate ?? "" })} value={money(locale, quote.vatAmountMinor, quote.currency)} />
            </>}
          </div>
          <div className="mx-[19px] border-t border-white/15 pb-[17px] pt-[15px]">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs text-zinc-300/75">{t("checkoutSummaryDueNowInclVat")}</span>
              <strong className="text-2xl font-bold leading-none tracking-[-0.035em] tabular-nums">{quote ? dueNow : "—"}</strong>
            </div>
            {quote && <p className="mt-2 text-[0.625rem] leading-relaxed text-zinc-300/60">{t("checkoutSummaryFutureSubscription")} · {money(locale, quote.futureSubscriptionGrossMinor, quote.currency)}</p>}
          </div>
          {showsRailAction && <div className="border-t border-white/5 bg-white/[0.03] px-[19px] pb-[19px] pt-[15px] [&>button]:min-h-[50px] [&>button]:w-full">
            <CheckoutPrimaryActionButton action={primaryAction} dueNow={dueNow} handlers={handlers} />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[0.625rem] leading-relaxed text-zinc-300/60">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />{t("checkoutMollieSecurityNote")}
            </p>
          </div>}
        </CardContent>
      </Card>
      <p className="mx-[5px] mt-2.5 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-[15px] shrink-0" aria-hidden />
        <span>{t("checkoutCompactSummarySaved")}</span>
      </p>
    </aside>
  )
}

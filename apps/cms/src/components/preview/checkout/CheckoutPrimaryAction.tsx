"use client"

import { CheckCircle2, Globe2, Info, Loader2, LockKeyhole } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@siteinabox/ui/components/button"

import type { CheckoutPrimaryAction } from "./checkoutPresentation"

export type CheckoutPrimaryActionHandlers = {
  onDomainNext: () => void
  onDomainCheck: () => void
  onDetailsNext: () => void
  onPay: () => void
}

export function CheckoutPrimaryActionButton({
  action,
  dueNow,
  handlers,
}: {
  action: CheckoutPrimaryAction
  dueNow: string
  handlers: CheckoutPrimaryActionHandlers
}) {
  const t = useTranslations("preview")
  const labels = {
    check_domain: t("checkoutCheckDomain"),
    check_again: t("checkoutCheckAgain"),
    domain_unavailable: t("checkoutDomainOccupied"),
    migration_no_order: t("checkoutMigrationPreflightNoOrder"),
    verify_migration_source: t("checkoutMigrationVerifySource"),
    continue_to_review: t("checkoutNext"),
    complete_details: t("checkoutDetailsSave"),
    pay: t("checkoutStartPaymentAmount", { amount: dueNow }),
    payment_complete: t("paymentCompleted"),
    wait: t("checkoutPaymentReturnPending"),
  } as const
  const onClick = {
    check_domain: handlers.onDomainCheck,
    continue_to_review: handlers.onDomainNext,
    complete_details: handlers.onDetailsNext,
    pay: handlers.onPay,
    wait: undefined,
  }[action.kind]
  const Icon = action.pending
    ? Loader2
    : action.kind === "pay"
      ? LockKeyhole
      : action.kind === "check_domain"
        ? Globe2
        : action.kind === "wait"
          ? Info
          : CheckCircle2

  return (
    <Button
      type="button"
      variant={action.label === "domain_unavailable" ? "ghost" : action.label === "migration_no_order" ? "outline" : "default"}
      className={action.label === "domain_unavailable" || action.label === "migration_no_order"
        ? "min-w-0 flex-1 whitespace-normal text-center md:flex-none"
        : "min-w-0 flex-1 whitespace-normal bg-brand text-center text-brand-foreground hover:bg-brand/90 focus-visible:ring-brand/40 md:flex-none"}
      disabled={action.disabled}
      aria-describedby={action.describedBy}
      onClick={onClick}
    >
      <Icon className={action.pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {labels[action.label]}
    </Button>
  )
}

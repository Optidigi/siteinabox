"use client"

import { Check, Loader2 } from "lucide-react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { PreviewCheckoutDomainOption } from "@/lib/checkout/previewCheckoutContract"

export function DomainOptionRow({
  option,
  selected,
  checking = false,
  onSelect,
}: {
  option: PreviewCheckoutDomainOption
  selected?: boolean
  checking?: boolean
  onSelect?: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  const content = (
    <>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="[overflow-wrap:anywhere] text-sm font-medium text-foreground">{option.domain}</span>
        {!option.included && option.extraFeeLabel && <span className="text-sm text-muted-foreground">{t("checkoutDomainExtraFeeInline", { extraFee: option.extraFeeLabel })}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {checking ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden /> : option.included ? <span className="text-success" aria-label={t("checkoutDomainIncludedBadge")}><Check className="size-5" aria-hidden /></span> : <Badge variant="secondary">{t("checkoutDomainExtraFeeBadge")}</Badge>}
        {selected && !option.included && <span className="text-success"><Check className="size-5" aria-hidden /><span className="sr-only">{t("checkoutDomainSelected")}</span></span>}
      </span>
    </>
  )
  if (onSelect) {
    return <Button type="button" variant="ghost" className={cn("h-auto min-h-12 w-full justify-between whitespace-normal border border-transparent bg-success/10 p-2.5 text-left shadow-sm shadow-success/10 ring-2 ring-success/70 hover:bg-success/15 hover:ring-success dark:bg-success/10 dark:shadow-success/15 dark:hover:bg-success/15", selected && "bg-success/15 ring-success dark:bg-success/15")} aria-pressed={selected} onClick={() => onSelect(option)}>{content}</Button>
  }
  return <div className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-md border bg-background p-2.5", selected && "border-transparent bg-success/10 shadow-sm shadow-success/10 ring-2 ring-success/70", checking && "border-border bg-muted/30 text-muted-foreground")} aria-busy={checking}>{content}</div>
}

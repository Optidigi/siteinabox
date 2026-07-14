import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleDot, CreditCard } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { OperationsStatusMetric } from "@/lib/queries/generationOperations"

const icons = {
  "preview-ready": CircleDot,
  "checkout-completed": CreditCard,
  live: CheckCircle2,
  "needs-attention": AlertTriangle,
} as const

const tone = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
} as const

export function OperationsStatusStrip({ metrics }: { metrics: OperationsStatusMetric[] }) {
  const t = useTranslations("generationOperations")
  return (
    <section aria-label={t("statusStrip.ariaLabel")} className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = icons[metric.key]
        return <Link
          key={metric.key}
          href={metric.href}
          className={cn(
            "block min-w-0 p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            index > 0 && "border-t sm:border-l sm:border-t-0",
            index === 2 && "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">{t(`statusStrip.${metric.key}.label`)}</span>
            <Icon className={cn("size-4 shrink-0", tone[metric.tone])} aria-hidden />
          </div>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone[metric.tone])}>{metric.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(`statusStrip.${metric.key}.helper`)}</p>
        </Link>
      })}
    </section>
  )
}

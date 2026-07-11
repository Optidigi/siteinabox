import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import type { LegalStatusMetric } from "@/lib/queries/legalOperations"
import { useTranslations } from "next-intl"

const toneClasses: Record<LegalStatusMetric["tone"], string> = {
  neutral: "text-foreground",
  info: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

const icons: Record<LegalStatusMetric["tone"], typeof Info> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: CircleAlert,
}

export function LegalStatusStrip({ metrics }: { metrics: LegalStatusMetric[] }) {
  const t = useTranslations("legalOperations")
  return (
    <section aria-label={t("statusStrip.ariaLabel")} className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = icons[metric.tone]!
        const content = (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">{t.has(`statusStrip.${metric.key}.label`) ? t(`statusStrip.${metric.key}.label`) : metric.label}</span>
              <Icon className={cn("size-4 shrink-0", toneClasses[metric.tone])} aria-hidden />
            </div>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClasses[metric.tone])}>{metric.value}</p>
            {metric.helper && <p className="mt-1 text-xs text-muted-foreground">{t.has(`statusStrip.${metric.key}.helper`) ? t(`statusStrip.${metric.key}.helper`) : metric.helper}</p>}
          </>
        )
        return metric.href ? (
          <Link
            key={metric.key}
            href={metric.href}
            className={cn("block min-w-0 p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", index > 0 && "border-t sm:border-l sm:border-t-0", index === 2 && "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0")}
          >
            {content}
          </Link>
        ) : (
          <div key={metric.key} className={cn("min-w-0 p-4", index > 0 && "border-t sm:border-l sm:border-t-0", index === 2 && "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0")}>
            {content}
          </div>
        )
      })}
    </section>
  )
}

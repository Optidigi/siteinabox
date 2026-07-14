import Link from "next/link"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { ListSearch } from "@/components/list-search"
import { useTranslations } from "next-intl"
import type { GenerationRunFilter } from "@/lib/queries/generationOperations"

const statuses: Array<{ value: GenerationRunFilter; key: string }> = [
  { value: "all", key: "all" },
  { value: "preview-ready", key: "previewReady" },
  { value: "checkout-completed", key: "checkoutCompleted" },
  { value: "live", key: "live" },
  { value: "needs-attention", key: "needsAttention" },
]

export function OperationsListToolbar({ placeholder, activeStatus, basePath, query, showStatuses = true }: {
  placeholder: string
  activeStatus: GenerationRunFilter
  basePath: string
  query?: string
  showStatuses?: boolean
}) {
  const t = useTranslations("generationOperations")
  return <div className="flex flex-col gap-3">
    <ListSearch placeholder={placeholder} />
    {showStatuses && <div className="flex flex-wrap gap-2" aria-label={t("filters.ariaLabel")}>
      {statuses.map((status) => {
        const active = status.value === activeStatus
        const params = new URLSearchParams()
        if (status.value !== "all") params.set("status", status.value)
        if (query?.trim()) params.set("q", query.trim())
        const href = params.size ? `${basePath}?${params}` : basePath
        return <Link key={status.value} href={href} aria-current={active ? "page" : undefined} className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }))}>{t(`filters.${status.key}`)}</Link>
      })}
    </div>}
  </div>
}

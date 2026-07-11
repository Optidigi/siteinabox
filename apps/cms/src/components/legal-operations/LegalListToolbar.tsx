import Link from "next/link"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { ListSearch } from "@/components/list-search"

export function LegalListToolbar({ placeholder, activeStatus, statuses, basePath, query }: {
  placeholder: string
  activeStatus: string
  statuses: Array<{ value: string; label: string }>
  basePath: string
  query?: string
}) {
  return <div className="flex flex-col gap-3">
    <ListSearch placeholder={placeholder} />
    <div className="flex flex-wrap gap-2" aria-label="Statusfilter">
      {statuses.map((status) => {
        const active = status.value === activeStatus
        const params = new URLSearchParams()
        if (status.value !== "all") params.set("status", status.value)
        if (query?.trim()) params.set("q", query.trim())
        const href = params.size ? `${basePath}?${params}` : basePath
        return <Link key={status.value} href={href} aria-current={active ? "page" : undefined} className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }))}>{status.label}</Link>
      })}
    </div>
  </div>
}

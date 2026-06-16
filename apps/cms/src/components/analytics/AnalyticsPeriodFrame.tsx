"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { CalendarDays, LoaderCircle } from "lucide-react"
import { AnalyticsLoadingSkeleton } from "@/components/analytics/AnalyticsLoadingSkeleton"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@siteinabox/ui/components/tabs"

type AnalyticsPeriodFrameProps = {
  days: 7 | 30 | 90
  basePath: string
  labels: {
    days7: string
    days30: string
    days90: string
  }
  children: React.ReactNode
  tenantId?: string | null
  activeView?: string
  views?: {
    value: string
    label: string
  }[]
  title?: string
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  tenantFilter?: {
    selectedTenantId: string | null
    label: string
    allLabel: string
    tenants: {
      id: string
      name: string
    }[]
  }
}

export function AnalyticsPeriodFrame({
  days,
  basePath,
  labels,
  children,
  tenantId,
  activeView,
  views,
  title,
  subtitle,
  trailing,
  tenantFilter,
}: AnalyticsPeriodFrameProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pendingDays, setPendingDays] = useState<7 | 30 | 90 | null>(null)
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeDays = pendingDays ?? days
  const activeTenantId = pendingTenantId ?? tenantFilter?.selectedTenantId ?? "all"

  useEffect(() => {
    setPendingDays(null)
    setPendingTenantId(null)
  }, [days, tenantFilter?.selectedTenantId, activeView])

  const pushParams = (params: URLSearchParams) => {
    if (tenantId) params.set("tenantId", tenantId)
    else params.delete("tenantId")
    router.push(`${basePath}?${params.toString()}`)
  }

  const selectDays = (nextDays: 7 | 30 | 90) => {
    if (nextDays === days && pathname === basePath) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("days", String(nextDays))
    setPendingDays(nextDays)
    startTransition(() => {
      pushParams(params)
    })
  }

  const periodOptions = [
    { value: 7 as const, label: labels.days7 },
    { value: 30 as const, label: labels.days30 },
    { value: 90 as const, label: labels.days90 },
  ]
  const activePeriodLabel = periodOptions.find((option) => option.value === activeDays)?.label ?? String(activeDays)

  const selectView = (nextView: string) => {
    if (nextView === activeView && pathname === basePath) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", nextView)
    setPendingDays(null)
    startTransition(() => {
      pushParams(params)
    })
  }

  const selectTenant = (nextTenantId: string) => {
    if (!tenantFilter) return
    if (nextTenantId === (tenantFilter.selectedTenantId ?? "all") && pathname === basePath) return
    const params = new URLSearchParams(searchParams.toString())
    if (nextTenantId === "all") params.delete("tenantId")
    else params.set("tenantId", nextTenantId)
    setPendingTenantId(nextTenantId)
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  const tenantSelect = tenantFilter ? (
    <Select value={activeTenantId} onValueChange={selectTenant}>
      <SelectTrigger size="sm" className="w-[176px] max-w-full" disabled={isPending} aria-label={tenantFilter.label}>
        {isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{tenantFilter.allLabel}</SelectItem>
        {tenantFilter.tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>
            {tenant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {title && (
          <header className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
              {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex min-w-0 shrink-0 flex-row flex-wrap items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={isPending}
                    aria-label={`Period: ${activePeriodLabel}`}
                  >
                    <CalendarDays className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={String(activeDays)}
                    onValueChange={(value) => selectDays(Number(value) as 7 | 30 | 90)}
                  >
                    {periodOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {tenantSelect}
              {trailing}
            </div>
          </header>
        )}
        <div className="flex min-w-0 flex-col gap-2 @min-[42rem]/site-frame:flex-row @min-[42rem]/site-frame:items-center @min-[42rem]/site-frame:justify-between">
          {views && activeView && (
            <Tabs value={activeView} onValueChange={selectView} className="min-w-0 max-w-full">
              <TabsList className="max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" variant="line">
                {views.map((option) => (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    disabled={isPending}
                    aria-current={activeView === option.value ? "page" : undefined}
                  >
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {!title && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={isPending}
                    aria-label={`Period: ${activePeriodLabel}`}
                  >
                    <CalendarDays className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={String(activeDays)}
                    onValueChange={(value) => selectDays(Number(value) as 7 | 30 | 90)}
                  >
                    {periodOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {tenantSelect}
              {trailing}
            </div>
          )}
        </div>
      </div>
      {isPending ? <AnalyticsLoadingSkeleton /> : children}
    </div>
  )
}

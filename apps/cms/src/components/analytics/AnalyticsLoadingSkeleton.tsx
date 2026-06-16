import { Skeleton } from "@siteinabox/ui/components/skeleton"

export function AnalyticsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-[320px] w-full" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[280px] w-full" />
        <Skeleton className="h-[280px] w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[240px] w-full" />
        <Skeleton className="h-[240px] w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    </div>
  )
}

import { Skeleton } from "@siteinabox/ui/components/skeleton"

/**
 * Tenant overview (dashboard) loading skeleton — header + 4 stat cards
 * + chart + activity feed. Mirrors the rendered shape so the layout
 * doesn't shift when the RSC data resolves.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

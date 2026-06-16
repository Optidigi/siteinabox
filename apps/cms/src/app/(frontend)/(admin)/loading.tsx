import { Skeleton } from "@siteinabox/ui/components/skeleton"

/**
 * Admin root loading skeleton — generic header + card + rows shape that
 * covers the dashboard, listings, and most admin landing pages while
 * RSC data resolves. Tailored skeletons in deeper segments override this.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

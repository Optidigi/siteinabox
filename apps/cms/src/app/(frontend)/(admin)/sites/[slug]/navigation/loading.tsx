import { Skeleton } from "@siteinabox/ui/components/skeleton"

/**
 * Navigation manager loading skeleton — header + zone tabs + a short
 * list of entry rows. Matches the rendered shape to avoid layout shift.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-9 w-56" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  )
}

import { Skeleton } from "@siteinabox/ui/components/skeleton"

/**
 * Users listing loading skeleton — header (title + new-user button) +
 * filter row + table rows. Generic listing shape; matches the rendered
 * layout closely enough to avoid CLS on resolve.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

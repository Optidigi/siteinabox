import { cn } from "@siteinabox/ui/lib/utils"

type Props = {
  /**
   * Pre-rendered icon JSX (e.g. `<FileText className="h-10 w-10 text-muted-foreground" />`).
   * NOT a component reference — passing a Lucide component reference like
   * `icon={FileText}` from a server page to a client component breaks at
   * build time because function references can't cross the RSC boundary.
   * Pass rendered JSX instead.
   */
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Empty state for tables, lists, and content areas. Use as the empty-rows
 * render of DataTable or any "no items" surface.
 */
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 px-4 max-md:px-2 text-center border border-dashed rounded-lg",
        className,
      )}
    >
      {icon}
      <div className="space-y-1">
        <p className="text-base font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

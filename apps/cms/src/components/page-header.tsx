import { cn } from "@siteinabox/ui/lib/utils"

type Props = {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /**
   * Optional content rendered above the title (e.g. a tenant/site context
   * pill, breadcrumb, or back link). Pass any JSX — the design system stays
   * agnostic to your routing model.
   */
  beforeTitle?: React.ReactNode
  className?: string
}

/**
 * Per-page header primitive. Stacks title above action on phone, inlines on
 * desktop. `beforeTitle` slot accepts any context affordance (tenant pill,
 * breadcrumb, etc.).
 */
export function PageHeader({ title, subtitle, action, beforeTitle, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {beforeTitle && <div className="mb-1.5">{beforeTitle}</div>}
        <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0 max-sm:w-full [&>*]:max-sm:w-full">{action}</div>
      )}
    </header>
  )
}
